;;; elisp-nav.el --- CLI navigation for Emacs Lisp -*- lexical-binding: t -*-

;; Usage (batch mode examples):
;; emacs --batch -l /Users/yilinzhang/.agents/skills/elisp-nav/elisp-nav.el -- --file /path/to/file.el --def symbol
;; emacs --batch -l /Users/yilinzhang/.agents/skills/elisp-nav/elisp-nav.el -- --file /path/to/file.el --refs symbol
;; emacs --batch -l /Users/yilinzhang/.agents/skills/elisp-nav/elisp-nav.el -- --file /path/to/file.el --sexp-at 120:3
;; emacs --batch -l /Users/yilinzhang/.agents/skills/elisp-nav/elisp-nav.el -- --file /path/to/file.el --form-path 120:3
;; emacs --batch -l /Users/yilinzhang/.agents/skills/elisp-nav/elisp-nav.el -- --dir /path/to/dir --def symbol

(require 'cl-lib)
(require 'subr-x)

(defconst elisp-nav--ignore-dir-regex
  (rx (or "/.git/" "/node_modules/" "/dist/" "/build/" "/target/" "/.cache/" "/.elpa/"))
  "Regex of directory paths to ignore during scans.")

(defconst elisp-nav--defun-regex
  "^(\\s-*\\(defun\\|cl-defun\\|defmacro\\|cl-defmacro\\|defsubst\\|defalias\\|defcustom\\|defvar\\|defconst\\|defgroup\\|define-derived-mode\\|define-minor-mode\\|define-globalized-minor-mode\\|define-obsolete-function-alias\\)\\_>\\s-+\\(\\(?:\\sw\\|\\s_\\)+\\)"
  "Regex that matches common definition forms and captures the symbol name.")

(defun elisp-nav--emit (format-string &rest args)
  "Print FORMAT-STRING with ARGS followed by a newline."
  (princ (apply #'format format-string args))
  (princ "\n"))

(defun elisp-nav--parse-args (args)
  "Parse ARGS into a plist."
  (let (plist)
    (while args
      (let ((arg (pop args)))
        (when (string= arg "--")
          (setq arg (pop args)))
        (pcase arg
          ("--file" (setq plist (plist-put plist :file (pop args))))
          ("--dir" (setq plist (plist-put plist :dir (pop args))))
          ("--def" (setq plist (plist-put plist :def (pop args))))
          ("--refs" (setq plist (plist-put plist :refs (pop args))))
          ("--sexp-at" (setq plist (plist-put plist :sexp-at (pop args))))
          ("--form-path" (setq plist (plist-put plist :form-path (pop args))))
          (_ (error "Unknown argument: %s" arg)))))
    plist))

(defun elisp-nav--parse-line-col (value)
  "Parse VALUE as LINE:COL and return a cons cell (LINE . COL)."
  (let* ((parts (split-string value ":"))
         (line (string-to-number (car parts)))
         (col (string-to-number (cadr parts))))
    (unless (and (> line 0) (> col 0))
      (error "Invalid line:col: %s" value))
    (cons line col)))

(defun elisp-nav--goto-line-col (line col)
  "Move point to LINE and COL (1-based)."
  (goto-char (point-min))
  (forward-line (1- line))
  (move-to-column (1- col)))

(defun elisp-nav--line-col-at (pos)
  "Return (LINE . COL) at POS (1-based)."
  (save-excursion
    (goto-char pos)
    (cons (line-number-at-pos)
          (1+ (current-column)))))

(defun elisp-nav--collect-defs (symbol)
  "Return a list of definition positions for SYMBOL in current buffer.
Each entry is a list (START-LINE START-COL END-LINE AUTOLOAD-P)."
  (let (results)
    (save-excursion
      (goto-char (point-min))
      (while (re-search-forward elisp-nav--defun-regex nil t)
        (let ((name (match-string 2))
              (pos (match-beginning 0)))
          (when (string= name symbol)
            (let* ((start (elisp-nav--line-col-at pos))
                   (start-line (max 1 (1- (car start))))
                   (end-pos (ignore-errors (scan-sexps pos 1)))
                   (end-line (if end-pos
                                 (line-number-at-pos (max (1- end-pos) pos))
                               (car start)))
                   (autoload-p (save-excursion
                                  (goto-char pos)
                                  (forward-line -1)
                                  (beginning-of-line)
                                  (looking-at-p "^\\s-*;;;###autoload\\s-*$"))))
              (push (list start-line (cdr start) end-line autoload-p) results))))))
    (nreverse results)))

(defun elisp-nav--collect-refs (symbol)
  "Return a list of reference positions for SYMBOL in current buffer.
Each entry is a cons cell (LINE . COL)."
  (let (results)
    (save-excursion
      (goto-char (point-min))
      (let ((pattern (concat "\\_<" (regexp-quote symbol) "\\_>")))
        (while (re-search-forward pattern nil t)
          (push (elisp-nav--line-col-at (match-beginning 0)) results))))
    (nreverse results)))

(defun elisp-nav--sexp-at (line col)
  "Return the sexp surrounding LINE and COL as a string."
  (save-excursion
    (elisp-nav--goto-line-col line col)
    (let* ((ppss (syntax-ppss))
           (beg (or (nth 1 ppss)
                    (and (looking-at-p "\\s(") (point))
                    (ignore-errors (scan-sexps (point) -1)))))
      (unless beg
        (error "No containing form at %d:%d" line col))
      (let ((end (ignore-errors (scan-sexps beg 1))))
        (unless end
          (error "Unbalanced form at %d:%d" line col))
        (buffer-substring-no-properties beg end)))))

(defun elisp-nav--form-path (line col)
  "Return a list of parent form names for LINE and COL.
Each entry is a cons cell (NAME . (LINE . COL))."
  (save-excursion
    (elisp-nav--goto-line-col line col)
    (let (paths)
      (while (let ((ppss (syntax-ppss)))
               (when-let ((beg (nth 1 ppss)))
                 (let ((name (save-excursion
                               (goto-char (1+ beg))
                               (skip-syntax-forward " ")
                               (or (thing-at-point 'symbol t) "<anonymous>")))
                       (pos (elisp-nav--line-col-at beg)))
                   (push (cons name pos) paths)
                   (goto-char (1- beg))
                   t))))
      (nreverse paths))))

(defun elisp-nav--with-file-buffer (file fn)
  "Visit FILE in a temp buffer and call FN."
  (with-temp-buffer
    (insert-file-contents file)
    (emacs-lisp-mode)
    (funcall fn)))

(defun elisp-nav--scan-files (root)
  "Return list of .el files under ROOT, skipping ignored directories."
  (let ((files (directory-files-recursively root "\\.el\\'" nil nil t)))
    (cl-remove-if (lambda (file)
                    (string-match-p elisp-nav--ignore-dir-regex file))
                  files)))

(defun elisp-nav--run (plist)
  "Execute command based on PLIST arguments."
  (let ((file (plist-get plist :file))
        (dir (plist-get plist :dir))
        (def (plist-get plist :def))
        (refs (plist-get plist :refs))
        (sexp-at (plist-get plist :sexp-at))
        (form-path (plist-get plist :form-path)))
    (when (and file dir)
      (error "Use either --file or --dir, not both"))
    (when (and (or def refs) (or sexp-at form-path))
      (error "Use either --def/--refs or --sexp-at/--form-path"))
    (when (and (or sexp-at form-path) (not file))
      (error "--sexp-at and --form-path require --file"))
    (when (and (not (or file dir)) (or def refs sexp-at form-path))
      (error "Missing --file or --dir"))
    (cond
     (def
      (let ((files (if dir (elisp-nav--scan-files dir) (list file))))
        (dolist (path files)
          (elisp-nav--with-file-buffer
           path
           (lambda ()
             (dolist (entry (elisp-nav--collect-defs def))
               (elisp-nav--emit "def %s:%d:%d:%d:%s"
                                path
                                (nth 0 entry)
                                (nth 1 entry)
                                (nth 2 entry)
                                (if (nth 3 entry) "autoload" "noautoload"))))))))
     (refs
      (let ((files (if dir (elisp-nav--scan-files dir) (list file))))
        (dolist (path files)
          (elisp-nav--with-file-buffer
           path
           (lambda ()
             (dolist (pos (elisp-nav--collect-refs refs))
               (elisp-nav--emit "ref %s:%d:%d" path (car pos) (cdr pos))))))))
     (sexp-at
      (let* ((pair (elisp-nav--parse-line-col sexp-at))
             (line (car pair))
             (col (cdr pair)))
        (elisp-nav--with-file-buffer
         file
         (lambda ()
           (elisp-nav--emit "sexp %s:%d:%d" file line col)
           (elisp-nav--emit "%s" (elisp-nav--sexp-at line col))))))
     (form-path
      (let* ((pair (elisp-nav--parse-line-col form-path))
             (line (car pair))
             (col (cdr pair)))
        (elisp-nav--with-file-buffer
         file
         (lambda ()
           (elisp-nav--emit "path %s:%d:%d" file line col)
           (dolist (entry (elisp-nav--form-path line col))
             (elisp-nav--emit "%s %d:%d" (car entry) (car (cdr entry)) (cdr (cdr entry))))))))
     (t
      (error "No command specified")))))

(defun elisp-nav-main ()
  "Entry point for batch execution."
  (let ((args (or command-line-args-left nil)))
    (condition-case err
        (elisp-nav--run (elisp-nav--parse-args args))
      (error
       (elisp-nav--emit "error %s" (error-message-string err))
       (kill-emacs 1)))))

(when noninteractive
  (elisp-nav-main))

;;; elisp-nav.el ends here
