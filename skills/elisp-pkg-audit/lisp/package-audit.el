;;; package-audit.el --- Audit package.el upgrades  -*- lexical-binding: t; -*-

;;; Commentary:

;; Helper functions used by the elisp-pkg-audit skill.

;;; Code:

(require 'cl-lib)
(require 'json)
(require 'package)
(require 'subr-x)
(require 'url-handlers)

(defconst elisp-pkg-audit-diff-command
  '("diff" "-ruN"
    "--exclude=.git"
    "--exclude=.github"
    "--exclude=.gitignore"
    "--exclude=*.elc"
    "--exclude=*-autoloads.el"
    "--exclude=.dir-locals.el"
    "--exclude=dir"
    "--exclude=README*"
    "--exclude=LICENSE*"
    "--exclude=COPYING*"
    "--exclude=Eask")
  "Command used to generate package diffs.")

(cl-defstruct (elisp-pkg-audit-record
               (:constructor elisp-pkg-audit-record-create))
  name
  installed-desc
  available-desc
  installed-version
  available-version
  installed-vc-p
  archive
  homepage
  download-url
  installed-dir
  expanded-dir
  diff-file
  status
  upgrade-strategy
  note)

(defun elisp-pkg-audit--version-string (desc)
  "Return DESC version as a string, or nil."
  (when (and desc (package-desc-version desc))
    (package-version-join (package-desc-version desc))))

(defun elisp-pkg-audit--homepage (desc)
  "Return homepage URL for DESC, or nil."
  (when desc
    (or (cdr (assq :url (package-desc-extras desc)))
        (cdr (assq :homepage (package-desc-extras desc))))))

(defun elisp-pkg-audit--normalize-names (names)
  "Normalize NAMES into a list of symbols."
  (mapcar (lambda (name)
            (if (symbolp name) name (intern name)))
          names))

(defun elisp-pkg-audit--upgrade-strategy (installed-desc available-desc)
  "Choose upgrade strategy for INSTALLED-DESC and AVAILABLE-DESC."
  (cond
   ((and installed-desc (package-vc-p installed-desc) available-desc) 'archive-preview-only)
   ((and installed-desc (package-vc-p installed-desc)) 'manual-vc)
   (available-desc 'archive)
   (t 'manual-vc)))

(defun elisp-pkg-audit-upgrade-records (&optional names)
  "Return audit records for upgradeable packages.
If NAMES is non-nil, limit results to those package names."
  (package-initialize)
  (package--archives-initialize)
  (let* ((wanted (and names (elisp-pkg-audit--normalize-names names)))
         (upgradeable (package--upgradeable-packages)))
    (when wanted
      (setq upgradeable
            (seq-filter (lambda (name) (memq name wanted)) upgradeable)))
    (mapcar
     (lambda (name)
       (let* ((installed-desc (cadr (assq name package-alist)))
              (available-desc (cadr (assq name package-archive-contents)))
              (upgrade-strategy
               (elisp-pkg-audit--upgrade-strategy installed-desc available-desc))
              (download-url
               (when available-desc
                 (concat (package-archive-base available-desc)
                         (package-desc-full-name available-desc)
                         (package-desc-suffix available-desc)))))
         (elisp-pkg-audit-record-create
          :name name
          :installed-desc installed-desc
          :available-desc available-desc
          :installed-version (elisp-pkg-audit--version-string installed-desc)
          :available-version (elisp-pkg-audit--version-string available-desc)
          :installed-vc-p (and installed-desc (package-vc-p installed-desc))
          :archive (and available-desc (package-desc-archive available-desc))
          :homepage (elisp-pkg-audit--homepage available-desc)
          :download-url download-url
          :installed-dir (and installed-desc (package-desc-dir installed-desc))
          :status (if available-desc 'pending 'unsupported)
          :upgrade-strategy upgrade-strategy
          :note (unless available-desc
                  "No archive package-desc found; this package needs a separate package-vc audit path."))))
     upgradeable)))

(defun elisp-pkg-audit--ensure-directory (dir)
  "Create DIR and return it."
  (make-directory dir t)
  dir)

(defun elisp-pkg-audit--download-file (record download-dir)
  "Download RECORD artifact into DOWNLOAD-DIR."
  (let* ((desc (elisp-pkg-audit-record-available-desc record))
         (file-name (concat (package-desc-full-name desc)
                            (package-desc-suffix desc)))
         (target (expand-file-name file-name download-dir)))
    (url-copy-file (elisp-pkg-audit-record-download-url record) target t)
    target))

(defun elisp-pkg-audit--expand-tar (record tar-file target-dir)
  "Expand RECORD TAR-FILE under TARGET-DIR."
  (let ((root (expand-file-name
               (package-desc-full-name
                (elisp-pkg-audit-record-available-desc record))
               target-dir)))
    (with-temp-buffer
      (let ((exit-code (process-file "tar" nil (current-buffer) nil
                                     "-xf" tar-file "-C" target-dir)))
        (unless (zerop exit-code)
          (error "tar failed for %s with exit code %s: %s"
                 tar-file exit-code (string-trim (buffer-string))))))
    root))

(defun elisp-pkg-audit--expand-single-file (record artifact target-dir)
  "Expand RECORD single-file package ARTIFACT under TARGET-DIR."
  (let* ((root-name (package-desc-full-name
                     (elisp-pkg-audit-record-available-desc record)))
         (root (expand-file-name root-name target-dir))
         (target (expand-file-name (file-name-nondirectory artifact) root)))
    (make-directory root t)
    (copy-file artifact target t)
    root))

(defun elisp-pkg-audit--expand-artifact (record artifact target-dir)
  "Expand RECORD ARTIFACT under TARGET-DIR."
  (pcase (package-desc-suffix (elisp-pkg-audit-record-available-desc record))
    (".tar" (elisp-pkg-audit--expand-tar record artifact target-dir))
    (".el" (elisp-pkg-audit--expand-single-file record artifact target-dir))
    (suffix (error "Unsupported package suffix %s" suffix))))

(defun elisp-pkg-audit--diff-exit-ok-p (exit-code)
  "Return non-nil if EXIT-CODE from diff is expected."
  (member exit-code '(0 1)))

(defun elisp-pkg-audit--write-diff (old-dir new-dir diff-file)
  "Write recursive diff between OLD-DIR and NEW-DIR into DIFF-FILE."
  (with-temp-buffer
    (let ((exit-code
           (apply #'process-file
                  (car elisp-pkg-audit-diff-command)
                  nil
                  (current-buffer)
                  nil
                  (append (cdr elisp-pkg-audit-diff-command)
                          (list old-dir new-dir)))))
      (unless (elisp-pkg-audit--diff-exit-ok-p exit-code)
        (error "diff failed for %s and %s with exit code %s"
               old-dir new-dir exit-code))
      (write-region (point-min) (point-max) diff-file nil 'silent))))

(defun elisp-pkg-audit--record->plist (record)
  "Serialize RECORD for JSON output."
  (list :name (symbol-name (elisp-pkg-audit-record-name record))
        :installed-version (elisp-pkg-audit-record-installed-version record)
        :available-version (elisp-pkg-audit-record-available-version record)
        :installed-vc-p (and (elisp-pkg-audit-record-installed-vc-p record) t)
        :archive (elisp-pkg-audit-record-archive record)
        :homepage (elisp-pkg-audit-record-homepage record)
        :download-url (elisp-pkg-audit-record-download-url record)
        :installed-dir (elisp-pkg-audit-record-installed-dir record)
        :expanded-dir (elisp-pkg-audit-record-expanded-dir record)
        :diff-file (elisp-pkg-audit-record-diff-file record)
        :status (symbol-name (elisp-pkg-audit-record-status record))
        :upgrade-strategy (symbol-name (elisp-pkg-audit-record-upgrade-strategy record))
        :note (elisp-pkg-audit-record-note record)))

(defun elisp-pkg-audit--write-summary (records output-dir)
  "Write JSON summary for RECORDS into OUTPUT-DIR."
  (let ((json-encoding-pretty-print t))
    (with-temp-file (expand-file-name "summary.json" output-dir)
      (insert
       (json-encode
        (list :generated-at (format-time-string "%Y-%m-%dT%H:%M:%S%z")
              :package-user-dir package-user-dir
              :count (length records)
              :records (apply #'vector
                              (mapcar #'elisp-pkg-audit--record->plist
                                      records))))))))

(defun elisp-pkg-audit-export-diffs (output-dir &optional names)
  "Export diffs for upgradeable packages into OUTPUT-DIR.
If NAMES is non-nil, only export those packages."
  (let* ((output-dir (expand-file-name output-dir))
         (downloads-dir (elisp-pkg-audit--ensure-directory
                         (expand-file-name "downloads" output-dir)))
         (expanded-dir (elisp-pkg-audit--ensure-directory
                        (expand-file-name "expanded" output-dir)))
         (diffs-dir (elisp-pkg-audit--ensure-directory
                     (expand-file-name "diffs" output-dir)))
         (records (elisp-pkg-audit-upgrade-records names)))
    (dolist (record records)
      (when (elisp-pkg-audit-record-available-desc record)
        (condition-case err
            (let* ((artifact (elisp-pkg-audit--download-file record downloads-dir))
                   (unpacked (elisp-pkg-audit--expand-artifact record artifact expanded-dir))
                   (diff-file (expand-file-name
                               (format "%s.diff"
                                       (symbol-name (elisp-pkg-audit-record-name record)))
                               diffs-dir)))
              (setf (elisp-pkg-audit-record-expanded-dir record) unpacked)
              (setf (elisp-pkg-audit-record-diff-file record) diff-file)
              (elisp-pkg-audit--write-diff
               (elisp-pkg-audit-record-installed-dir record)
               unpacked
               diff-file)
              (setf (elisp-pkg-audit-record-status record) 'exported))
          (error
           (setf (elisp-pkg-audit-record-status record) 'failed)
           (setf (elisp-pkg-audit-record-note record)
                 (error-message-string err))))))
    (elisp-pkg-audit--write-summary records output-dir)
    records))

(defun elisp-pkg-audit-upgrade-archive-packages (names)
  "Upgrade explicitly named archive packages in NAMES.
Return a list of plists summarizing the result for each package."
  (package-initialize)
  (package-refresh-contents)
  (mapcar
   (lambda (name)
     (let* ((pkg (if (symbolp name) name (intern name)))
            (installed-desc (cadr (assq pkg package-alist)))
            (available-desc (cadr (assq pkg package-archive-contents))))
       (condition-case err
           (cond
            ((null installed-desc)
             (list :name (symbol-name pkg)
                   :status "skipped"
                   :note "Package is not installed."))
            ((package-vc-p installed-desc)
             (list :name (symbol-name pkg)
                   :status "skipped"
                   :note "Installed via package-vc; this skill does not auto-upgrade package-vc packages."))
            ((null available-desc)
             (list :name (symbol-name pkg)
                   :status "skipped"
                   :note "No archive package-desc available for upgrade."))
            (t
             (package-upgrade pkg)
             (let ((new-desc (cadr (assq pkg package-alist))))
               (list :name (symbol-name pkg)
                     :status "upgraded"
                     :version (elisp-pkg-audit--version-string new-desc)))))
         (error
          (list :name (symbol-name pkg)
                :status "failed"
                :note (error-message-string err))))))
   (elisp-pkg-audit--normalize-names names)))

(provide 'package-audit)

;;; package-audit.el ends here
