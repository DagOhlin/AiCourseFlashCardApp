// A small, safe Markdown renderer for card text.
// Supports: paragraphs, **bold**, *italic*, `code`, ```code blocks```,
// bullet / numbered lists (indent with 2 spaces to nest), | tables |,
// "> " notes and "### " headings. All input is HTML-escaped first.
(function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function inline(text) {
    var codes = [];
    var s = esc(text).replace(/`([^`]+)`/g, function (_, c) {
      codes.push(c);
      return "\u0000" + (codes.length - 1) + "\u0000";
    });
    s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?![*\w])/g, "$1<em>$2</em>");
    s = s.replace(/\n/g, "<br>");
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) {
      return "<code>" + codes[+i] + "</code>";
    });
  }

  var BULLET = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/;
  var TABLE_ROW = /^\s*\|.*\|\s*$/;
  var TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

  function renderList(items) {
    var html = "";
    var stack = [];
    items.forEach(function (it) {
      while (stack.length && it.indent < stack[stack.length - 1].indent) {
        html += "</li></" + stack.pop().tag + ">";
      }
      var top = stack[stack.length - 1];
      if (!top || it.indent > top.indent) {
        var tag = it.ordered ? "ol" : "ul";
        stack.push({ indent: it.indent, tag: tag });
        html += "<" + tag + "><li>";
      } else {
        html += "</li><li>";
      }
      html += inline(it.text);
    });
    while (stack.length) html += "</li></" + stack.pop().tag + ">";
    return html;
  }

  function splitRow(line) {
    var cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
    return cells.map(function (c) { return c.trim(); });
  }

  function renderTable(rows) {
    var html = '<div class="table-wrap"><table>';
    var body = rows;
    if (rows.length > 1 && TABLE_SEP.test(rows[1])) {
      html += "<thead><tr>" + splitRow(rows[0]).map(function (c) {
        return "<th>" + inline(c) + "</th>";
      }).join("") + "</tr></thead>";
      body = rows.slice(2);
    }
    html += "<tbody>" + body.map(function (r) {
      return "<tr>" + splitRow(r).map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
    }).join("") + "</tbody></table></div>";
    return html;
  }

  function render(src) {
    var lines = String(src == null ? "" : src).replace(/\r\n?/g, "\n").split("\n");
    var html = "";
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];

      if (/^\s*```/.test(line)) {
        var code = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
        i++;
        html += "<pre><code>" + esc(code.join("\n")) + "</code></pre>";
        continue;
      }
      if (/^\s*$/.test(line)) { i++; continue; }

      var h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h) { html += "<h4>" + inline(h[2]) + "</h4>"; i++; continue; }

      if (BULLET.test(line)) {
        var items = [];
        while (i < lines.length && (BULLET.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
          var m = BULLET.exec(lines[i]);
          if (m) {
            items.push({ indent: m[1].replace(/\t/g, "    ").length, ordered: /\d/.test(m[2]), text: m[3] });
          } else {
            items[items.length - 1].text += "\n" + lines[i].trim();
          }
          i++;
        }
        html += renderList(items);
        continue;
      }

      if (TABLE_ROW.test(line)) {
        var rows = [];
        while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(lines[i++]);
        html += renderTable(rows);
        continue;
      }

      if (/^>\s?/.test(line)) {
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
        html += '<blockquote>' + inline(quote.join("\n")) + "</blockquote>";
        continue;
      }

      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*```/.test(lines[i]) &&
             !BULLET.test(lines[i]) && !TABLE_ROW.test(lines[i]) && !/^>\s?/.test(lines[i]) &&
             !/^#{1,4}\s/.test(lines[i])) {
        para.push(lines[i++]);
      }
      html += "<p>" + inline(para.join("\n")) + "</p>";
    }
    return html;
  }

  window.renderMarkdown = render;
})();
