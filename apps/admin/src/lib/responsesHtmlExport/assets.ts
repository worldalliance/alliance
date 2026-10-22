export const STYLES = `
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #f4f4f2;
  color: #1c1c1c;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.6;
}
toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: #ffffff;
  border-bottom: 1px solid #d7d7d3;
}
toolbar .name { font-weight: 600; margin-right: auto; }
toolbar button {
  font: inherit;
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #c9c9c4;
  background: #ffffff;
  color: #1c1c1c;
  cursor: pointer;
}
toolbar button:hover { background: #f1f1ee; }
toolbar button.primary { background: #1c1c1c; color: #ffffff; border-color: #1c1c1c; }
toolbar button.primary:hover { background: #333333; }

form-export { display: block; max-width: 62rem; margin: 0 auto; padding: 24px; }

export-meta {
  display: block;
  margin-bottom: 24px;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #e2e2de;
  border-radius: 8px;
  font-size: 13px;
  color: #555555;
}
export-meta > * { display: block; }
exported-at::before { content: "exported at "; color: #999999; }
response-count::before { content: "responses "; color: #999999; }
snapshot-count::before { content: "snapshots "; color: #999999; }
first-response-at::before { content: "first response "; color: #999999; }
last-response-at::before { content: "last response "; color: #999999; }

variant { display: block; margin-bottom: 32px; }
variant::before {
  content: "variant " attr(name) " (form " attr(form-id) ")";
  display: block;
  padding: 6px 0;
  font-size: 18px;
  font-weight: 700;
}

snapshot {
  display: block;
  margin-bottom: 28px;
  background: #ffffff;
  border: 1px solid #d7d7d3;
  border-radius: 8px;
  overflow: hidden;
}
snapshot::before {
  content: "snapshot " attr(id) " (" attr(response-count) " responses)";
  display: block;
  padding: 8px 20px;
  background: #ecece8;
  border-bottom: 1px solid #d7d7d3;
  font-size: 13px;
  font-weight: 600;
}
snapshot[current="true"]::before {
  content: "snapshot " attr(id) " (" attr(response-count) " responses, current)";
  background: #e4efe0;
}

schema {
  display: block;
  padding: 14px 20px;
  background: #fbfbf9;
  border-bottom: 1px solid #e6e6e2;
}
schema::before {
  content: "what respondents saw";
  display: block;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9a9a92;
}
page { display: block; margin-top: 14px; }
page::before {
  content: "page " attr(index) ": " attr(title);
  display: block;
  font-size: 15px;
  font-weight: 700;
}
page:not([title])::before { content: "page " attr(index); }

display { display: block; margin: 6px 0; color: #444444; }
display[kind="header"] { margin-top: 12px; font-size: 17px; font-weight: 700; color: #141414; }
display[kind="label"] { font-weight: 600; }
display[kind="quote"] { padding-left: 12px; border-left: 3px solid #cccccc; font-style: italic; }
display[kind="html"] { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #77776f; }
display[kind="biglink"]::after { content: " (" attr(url) ")"; color: #8a8a84; font-size: 12px; }
display[kind="video"]::after { content: " (" attr(src) ")"; color: #8a8a84; font-size: 12px; }
display[kind="previousAnswer"]::before { content: "previous answer to " attr(source-field-id) " "; color: #8a8a84; }
display[kind="userLocation"]::before { content: "user location "; color: #8a8a84; }
display item { display: block; font-size: 13px; color: #77776f; }
display item::before { content: attr(alt); display: block; }
display item::after { content: attr(src); display: block; font-size: 11px; color: #9a9a92; word-break: break-all; }
section { display: block; margin: 4px 0 4px 14px; }
section::before { content: attr(title); display: block; font-weight: 600; }
message { display: block; }
message::before { content: attr(name) ": "; color: #8a8a84; }

group { display: block; margin: 10px 0; padding-left: 12px; border-left: 2px solid #deded8; }
group::before { content: attr(label); display: block; font-weight: 600; }

question {
  display: block;
  margin: 10px 0;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #e6e6e2;
  border-radius: 6px;
}
question::before {
  content: attr(id) " (" attr(kind) ")";
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #9a9a92;
}
question[required="true"]::after { content: "required"; display: block; font-size: 11px; color: #b4682a; }
question > label { display: block; font-weight: 600; color: #141414; }
question > description { display: block; font-size: 13px; color: #666660; }
question > option, question > sub-field {
  display: block;
  padding-left: 14px;
  font-size: 13px;
  color: #55554f;
  white-space: normal;
  overflow-wrap: break-word;
}
question > option::before { content: "- "; }
question > sub-field::before { content: attr(id) " (" attr(kind) ") "; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #9a9a92; }

responses { display: block; padding: 4px 20px 16px; }
response { display: block; padding: 12px 14px; border-top: 1px solid #ecece6; }
response:nth-of-type(even) { background: #faf9f6; }
response::before {
  content: "#" attr(id) "  " attr(submitted-at);
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #9a9a92;
}
respondent { display: block; font-weight: 600; }
respondent[withdrawn="true"]::after { content: " withdrew"; color: #b4682a; font-weight: 400; }

answer { display: block; margin: 8px 0; }
answer field-id { display: block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #8a8a84; }
answer field-label { display: block; font-size: 13px; font-weight: 600; color: #333330; }
answer[unanswered="true"]::after { content: "no answer"; display: block; font-size: 12px; color: #a8a8a2; }
answer[orphan="true"] field-id::after { content: " (not in this snapshot)"; color: #b4682a; }

raw {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #666660;
  white-space: pre-wrap;
  word-break: break-word;
}
pretty { display: block; white-space: pre-wrap; }
pretty item, pretty sub { display: block; font-size: inherit; vertical-align: baseline; }
pretty item[rank]::before { content: attr(rank) ". "; color: #8a8a84; }
pretty sub::before { content: attr(field) ": "; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #8a8a84; }
body.mode-labels pretty sub::before { content: attr(label) ": "; font-family: inherit; font-size: 13px; font-weight: 600; }
pretty item[index] { margin-top: 6px; }
pretty item[index]::before { content: "item " attr(index); display: block; font-size: 11px; color: #8a8a84; }

body.mode-raw pretty, body.mode-raw answer field-label { display: none; }
body.mode-labels raw, body.mode-labels answer field-id { display: none; }
`;

const EXPORT_SCRIPT = `
(function () {
  var body = document.body;
  var toggle = document.getElementById("mode-toggle");
  var download = document.getElementById("download-csv");

  function showingLabels() {
    return body.className.indexOf("mode-labels") !== -1;
  }

  function setMode(labels) {
    body.className = labels ? "mode-labels" : "mode-raw";
    toggle.textContent = labels ? "Showing labels" : "Showing raw values";
  }

  function nodeText(node) {
    if (!node) return "";
    var children = node.children;
    if (!children.length) return (node.textContent || "").trim();
    var parts = [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var text = nodeText(child);
      var prefix = showingLabels()
        ? child.getAttribute("label") || child.getAttribute("field")
        : child.getAttribute("field");
      if (prefix) text = prefix + ": " + text;
      if (text) parts.push(text);
    }
    return parts.join("; ");
  }

  function answerText(answer) {
    return nodeText(answer.querySelector(showingLabels() ? "pretty" : "raw"));
  }

  function csvCell(value) {
    var text = value == null ? "" : String(value);
    if (/[",\\r\\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function buildCsv() {
    var labels = showingLabels();
    var hasVariants = !!document.querySelector("variant");
    var headers = ["Response ID", "Submitted At", "Snapshot ID"];
    if (hasVariants) headers.push("Variant");
    headers = headers.concat(["Respondent", "User ID", "SID", "Withdrawn"]);

    var fieldIds = [];
    var headerByField = {};
    var allAnswers = document.querySelectorAll("answer");
    for (var i = 0; i < allAnswers.length; i++) {
      var field = allAnswers[i].getAttribute("field") || "";
      if (headerByField["f:" + field]) continue;
      fieldIds.push(field);
      headerByField["f:" + field] = labels
        ? allAnswers[i].getAttribute("label") || field
        : field;
    }

    var used = {};
    for (i = 0; i < headers.length; i++) used["h:" + headers[i]] = true;
    for (i = 0; i < fieldIds.length; i++) {
      var base = headerByField["f:" + fieldIds[i]];
      var name = base;
      var n = 2;
      while (used["h:" + name]) {
        name = base + " (" + n + ")";
        n++;
      }
      used["h:" + name] = true;
      headers.push(name);
    }

    var rows = [headers];
    var responses = document.querySelectorAll("response");
    for (i = 0; i < responses.length; i++) {
      var response = responses[i];
      var snapshot = response.closest("snapshot");
      var variant = response.closest("variant");
      var respondent = response.querySelector("respondent");
      var row = [
        response.getAttribute("id") || "",
        response.getAttribute("submitted-at") || "",
        snapshot ? snapshot.getAttribute("id") || "" : "",
      ];
      if (hasVariants) row.push(variant ? variant.getAttribute("name") || "" : "");
      row.push(respondent ? (respondent.textContent || "").trim() : "");
      row.push(respondent ? respondent.getAttribute("user-id") || "" : "");
      row.push(respondent ? respondent.getAttribute("sid") || "" : "");
      row.push(respondent ? respondent.getAttribute("withdrawn") || "" : "");

      var byField = {};
      var answers = response.querySelectorAll("answer");
      for (var j = 0; j < answers.length; j++) {
        byField["f:" + (answers[j].getAttribute("field") || "")] = answers[j];
      }
      for (j = 0; j < fieldIds.length; j++) {
        var answer = byField["f:" + fieldIds[j]];
        row.push(answer ? answerText(answer) : "");
      }
      rows.push(row);
    }

    var lines = [];
    for (i = 0; i < rows.length; i++) {
      var cells = [];
      for (j = 0; j < rows[i].length; j++) cells.push(csvCell(rows[i][j]));
      lines.push(cells.join(","));
    }
    return lines.join("\\r\\n");
  }

  toggle.addEventListener("click", function () {
    setMode(!showingLabels());
  });

  download.addEventListener("click", function () {
    var blob = new Blob(["\\ufeff" + buildCsv()], {
      type: "text/csv;charset=utf-8;",
    });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = CSV_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  setMode(false);
})();
`;

export const exportScript = (csvFileName: string): string =>
  `var CSV_FILE_NAME = ${JSON.stringify(csvFileName)};${EXPORT_SCRIPT}`;
