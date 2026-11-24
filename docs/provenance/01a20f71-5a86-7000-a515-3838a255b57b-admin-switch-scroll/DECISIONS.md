# Decisions

- **The switch's label is `relative`.** The switch's checkbox is `sr-only`, which positions it absolutely; with a static label its containing block was `<body>`, so focusing it on click scrolled the document past the admin's full-height layout. A positioned label keeps the checkbox inside it. See EVIDENCE.md. (agent decision)
- **`ImageUploadField` keeps its static label in this change.** It hides its file input the same way and may jump the same way, but no one reported it and this task covers only the action switches. See EVIDENCE.md. (agent decision)
