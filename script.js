/* ==========================================================================
   Body Scent — shared script (product.html, order.html, admin.html)
   Each section only runs if its page's elements exist, so this one file can
   be included on every page.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Config
     ------------------------------------------------------------------------ */
  var PRODUCTS_URL = "products.json";
  var ORDER_PAGE = "order.html";
  var THANKYOU_PAGE = "thankyou.html";
  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vT1jdLK8zmkm_-QlloG7LawgomElzrXUqP1MmrLYyrds2XubX6RuLQsM_5ZZh9Gyywc_wAJHxB67pPP/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function moodLabel(key) {
    for (var i = 0; i < MOODS.length; i++) {
      if (MOODS[i].key === key) return MOODS[i].label;
    }
    return key;
  }

  /* ------------------------------------------------------------------------
     1) product.html — product cards + mood filter
     ------------------------------------------------------------------------ */
  function initProductPage() {
    var filterBar = document.getElementById("filter-bar");
    var list = document.getElementById("product-list");
    if (!filterBar || !list) return;

    var products = [];
    var currentMood = "all";

    function showMessage(text) {
      list.textContent = "";
      var p = document.createElement("p");
      p.textContent = text;
      list.appendChild(p);
    }

    function buildOrderLink(product) {
      var itemName = product.size ? product.name + " " + product.size : product.name;
      var params = new URLSearchParams();
      params.set("item", itemName);
      params.set("price", String(product.price));
      return ORDER_PAGE + "?" + params.toString();
    }

    function buildCard(product) {
      var card = document.createElement("article");
      card.className = "product-card mood-" + product.mood;

      var img = document.createElement("img");
      img.className = "product-card__image";
      img.src = product.image;
      img.alt = product.name;
      img.loading = "lazy";
      card.appendChild(img);

      var body = document.createElement("div");
      body.className = "product-card__body";

      var mood = document.createElement("div");
      mood.className = "product-card__mood";
      var dot = document.createElement("span");
      dot.className = "mood-dot";
      dot.setAttribute("aria-hidden", "true");
      var moodText = document.createElement("span");
      moodText.textContent = moodLabel(product.mood);
      mood.appendChild(dot);
      mood.appendChild(moodText);
      body.appendChild(mood);

      var name = document.createElement("h3");
      name.className = "product-card__name";
      name.textContent = product.name;
      body.appendChild(name);

      var foot = document.createElement("div");
      foot.className = "product-card__foot";
      var price = document.createElement("span");
      price.className = "price";
      price.textContent = Number(product.price).toLocaleString("th-TH") + " บาท";
      foot.appendChild(price);
      if (product.size) {
        var size = document.createElement("span");
        size.className = "product-card__size";
        size.textContent = product.size;
        foot.appendChild(size);
      }
      body.appendChild(foot);

      var buy = document.createElement("a");
      buy.className = "btn btn--gold btn--block";
      buy.href = buildOrderLink(product);
      buy.textContent = "สั่งซื้อ";
      buy.style.marginTop = "1.5rem";
      body.appendChild(buy);

      card.appendChild(body);
      return card;
    }

    function render() {
      list.textContent = "";
      var shown = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });
      if (shown.length === 0) {
        showMessage("ยังไม่มีสินค้าในหมวดนี้");
        return;
      }
      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function updateButtons() {
      var buttons = filterBar.querySelectorAll("button");
      buttons.forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.dataset.mood === currentMood ? "true" : "false");
      });
    }

    function setMood(key) {
      currentMood = key;
      updateButtons();
      render();
    }

    function buildFilterBar() {
      filterBar.textContent = "";
      MOODS.forEach(function (m) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-btn";
        btn.dataset.mood = m.key;
        btn.textContent = m.label;
        btn.addEventListener("click", function () {
          setMood(m.key);
        });
        filterBar.appendChild(btn);
      });
    }

    function moodFromUrl() {
      var value = new URLSearchParams(window.location.search).get("mood");
      if (!value) return "all";
      value = value.trim().toLowerCase();
      var valid = MOODS.some(function (m) {
        return m.key === value;
      });
      return valid ? value : "all";
    }

    buildFilterBar();
    currentMood = moodFromUrl();
    updateButtons();
    showMessage("กำลังโหลดสินค้า...");

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        render();
      })
      .catch(function (error) {
        console.error(error);
        showMessage("ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ------------------------------------------------------------------------
     2) order.html — pre-fill from URL, submit to Apps Script
     ------------------------------------------------------------------------ */
  function initOrderPage() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    // Pre-fill #items and #total from ?item=...&price=...
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");
    var itemsField = document.getElementById("items");
    var totalField = document.getElementById("total");

    if (itemsField && item) itemsField.value = item;
    if (totalField && price) totalField.value = price;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      function val(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : "";
      }

      var payload = {
        customerName: val("customerName"),
        contact: val("contact"),
        items: val("items"),
        total: val("total"),
        note: val("note")
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch("https://script.google.com/macros/s/AKfycbwTuBbamCyRIADAye85MiRU5JpoT2YvXg2ibPHvImrqmxrqn0to7BYkQZz1beWCwWKk7g/exec", {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(() => {
          window.location.href = THANKYOU_PAGE;
        })
        .catch(error => {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ------------------------------------------------------------------------
     3) admin.html — orders table from published Google Sheet CSV
     ------------------------------------------------------------------------ */

  // Minimal CSV parser: handles quoted fields, escaped quotes (""),
  // commas and line breaks inside quotes, CRLF/LF, and a leading BOM.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }

    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    // Drop completely empty lines
    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    var COLUMNS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

    function showRow(text) {
      tbody.textContent = "";
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = COLUMNS;
      td.textContent = text;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showRow("กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // If the first row is a header (its first cell has no digits, unlike a
        // date/time), skip it.
        if (rows.length > 0 && !/\d/.test(rows[0][0] || "")) {
          rows.shift();
        }

        // Rows are appended to the sheet over time, so reversing puts the
        // newest order first.
        rows.reverse();

        if (rows.length === 0) {
          showRow("ยังไม่มีคำสั่งซื้อ");
          return;
        }

        tbody.textContent = "";
        rows.forEach(function (r) {
          var tr = document.createElement("tr");
          for (var i = 0; i < COLUMNS; i++) {
            var td = document.createElement("td");
            td.textContent = r[i] !== undefined ? r[i] : "";
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showRow("ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  ready(function () {
    initProductPage();
    initOrderPage();
    initAdminPage();
  });
})();
