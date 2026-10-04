# Web: HTML, CSS, HTTP, REST, JSON

Pages are planned to run in a sandboxed frame with no network; requests are
simulated at the level of method, path, input, status and body (no real
headers, cookies or sessions). Status key: [README](README.md).

**Today no card teaches HTML, CSS or HTTP.** The Library has 9 web entries
(form, input, label, button, link, list, class selector, padding/margin,
flex). JSON appears only in the JS and PHP Library pages.

## Planned, in arc order

| # | Concept | Plain meaning | Taught at | Checked by | Comes back | Status |
|---|---|---|---|---|---|---|
| 1 | HTML elements and nesting (`h1`, `ul`, `li`) | A page is boxes inside boxes; tags say what each part is | S7 "A page Sam's members can see" | rendered page: one h1 with the company name, every room in your table in visible text (cheat: names hidden in a comment) | S8, P1 | Planned (arc) |
| 2 | A form (`form action method`, `input name`, `button`) | Collects named values and sends them somewhere | S8 "The booking form" | customers fill it by label and press the button; the submission is captured | S9, S10 | Planned (arc), split: gaps.md C11 |
| 3 | Labels (`label for`) | Names a field for people and screen readers | S8 | customers find fields by label only (cheat: placeholder instead of label) | P6 | Planned (arc) |
| 4 | Input types (`datetime-local`, `select`) | The right control for a time or a room | S8 (your choice, not taught) | customers | none | Planned (arc), thin |
| 5 | Request and response: status codes 2xx | The server answers with a number and a body; 2xx means it worked | S9 | customers: status 2xx and a real row | S10 | Planned (arc), thin: gaps.md M-W1 |
| 6 | JSON as the answer format | Data as text both sides can read | S10 | customers read the server's reply | S11 | Planned (arc) |
| 7 | GET for reading | Ask for the day's bookings without changing anything | S11 | customers on both worlds | P10 | Planned (arc) |
| 8 | CSS rules, width, padding, viewport meta, tap size | Make it fit a phone; buttons at least 44 px tall | P1 "On my phone the Book button is tiny" | page at 375 px wide: no sideways scroll, button tall enough | none | Planned (arc), too big: gaps.md C8 |
| 9 | 409 Conflict | "That slot is taken" | P3 | scripted pair | P9 | Planned (arc) |
| 10 | 422 Unprocessable (validation) | "Your input is wrong, here is why" | P4, P6 | direct request still refused | none | Planned (arc) |
| 11 | `required` and other HTML checks | Friendly early checks; never the only check | P6 | server still refuses | none | Planned (arc) |
| 12 | XSS (cross-site scripting) | User text shown as code on the page | P7 | no element created from data | none | Planned (arc) |
| 13 | 403 Forbidden, logins | Signed in, but not allowed to do this | P14-P16 | replayed request refused | none | Planned (arc) |
| 14 | POST / PUT / DELETE, 201 Created | Create, change and cancel through an API | T54a | probes | none | Planned (LD) |
| 15 | JSON API endpoint with a status | A PHP function answering with data and a code | T40 | probes | T42 | Planned (LD) |
| 16 | Data minimisation | Send only what the screen needs | T78 | response checked | none | Planned (LD) |
| 17 | Form events + HTML validation together | `submit` handler, `preventDefault`, start before end | T80 | page | none | Planned (LD) |
| 18 | A CSS class toggled by code | Red for clashing slots | T81 | page state | none | Planned (LD) |
| 19 | 401 and failed requests | Signed out; the server is up but says no | T83 | customers on a 4xx | T101 | Planned (LD) |

## Library only

| # | Concept | Plain meaning | Library entry | Status |
|---|---|---|---|---|
| 20 | Links (`a href`) | Links go places; buttons do actions | web-link | Library |
| 21 | `button type` | Inside a form a button submits unless `type="button"` | web-button | Library |
| 22 | Class selector | `.alert { color: red }` styles every `class="alert"` | web-css-class | Library |
| 23 | Box model (padding, margin) | Space inside vs space outside a box | web-box-model | Library |
| 24 | Flexbox | Lay children out in a row with a gap | web-flex | Library |

## Missing (in no plan)

| # | Concept | Plain meaning | Status |
|---|---|---|---|
| 25 | HTTP anatomy | Method, URL, headers (Content-Type), status, body: one card before S9 | Missing |
| 26 | REST design | Resources as URLs, verbs, which codes when (200, 201, 204, 400, 401, 403, 404, 409, 422), safe and repeatable requests | Missing (only T54a) |
| 27 | Document skeleton and semantic HTML | `<!doctype html>`, `lang`, `meta charset`, `head`/`body`, `header`/`main`/`nav`, heading order | Missing |
| 28 | Cookies and sessions | How the browser remembers you between requests | Missing (cannot be simulated; bridge) |
| 29 | CORS and same-origin | Why a page may not call another site's API | Missing |
| 30 | Accessibility beyond labels | Keyboard use, focus, alt text, contrast, error messages tied to fields | Missing |
| 31 | Responsive CSS | Media queries, relative units, grid | Missing |
| 32 | The cascade and specificity | Which rule wins when two apply | Missing |
| 33 | HTML tables | The natural shape for an availability grid | Missing |
| 34 | HTTPS and caching basics | Why everything is HTTPS; why a page can be stale | Missing |
