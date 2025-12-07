// ===== Firebase SDK（Realtime Database）=====
import { initializeApp }
    from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getDatabase, ref, push, set, onChildAdded, remove, onChildRemoved
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// =============================
// ＊＊＊Firebaseの情報（入れてません）＊＊＊
// =============================
const firebaseConfig = {

};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// イベントが溜まっていく場所
const dbRef = ref(db, "pixel_sync");

// =============================
// 画面仕様
// =============================
const GRID_SIZE = 8;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;

// 左から：黒、白、赤、青、黄色、茶色、オレンジ、紫
const COLORS = [
    "#000000",
    "#FFFFFF",
    "#FF0000",
    "#0000FF",
    "#FFFF00",
    "#8B4513",
    "#FFA500",
    "#800080",
];

// 現在選択中の色（初期：黒）
let currentColor = COLORS[0];

// localStorageキー（保存は1件）
const SAVE_KEY = "PIXEL_SYNC_SAVE_1";

// =============================
// 3) 初期UI生成
// =============================

// カラーピッカーを作る
function renderPalette() {
    $("#palette").empty();

    COLORS.forEach((c, i) => {
        const chip = $(`<div class="color-chip"></div>`);
        chip.css("background", c);
        chip.attr("data-color", c);

        // 初期選択（黒）
        if (i === 0) chip.addClass("selected");

        $("#palette").append(chip);
    });
}

// 8x8の描画マスを作る
function renderGrid() {
    $("#grid").empty();

    for (let i = 0; i < CELL_COUNT; i++) {
        const cell = $(`<div class="cell"></div>`);
        cell.attr("data-index", i);
        cell.attr("data-color", "#FFFFFF");  // 初期は白
        $("#grid").append(cell);
    }
}

// 保存プレビュー（1件）を表示
function renderSavePreview(pixels) {
    $("#savePreview").empty();

    if (!pixels || pixels.length !== CELL_COUNT) {
        $("#savePreview").append(`<div class="hint">まだ保存がありません</div>`);
        return;
    }

    const mini = $(`<div class="mini-grid"></div>`);
    pixels.forEach((c) => {
        const mc = $(`<div class="mini-cell"></div>`);
        mc.css("background", c);
        mini.append(mc);
    });

    // 保存データをクリックで復元できるようにするため、
    // コンテナに属性を持たせる
    mini.attr("data-has-save", "1");

    $("#savePreview").append(mini);
}

// =============================
// 4) 盤面の操作ヘルパー
// =============================

// indexのマスを指定色で塗る（ローカルUI反映）
function paintCellLocal(index, color) {
    const cell = $(`.cell[data-index="${index}"]`);
    cell.css("background", color);
    cell.attr("data-color", color);
}

// 盤面全体を配列で適用（ローカルUI反映）
function applyPixelsLocal(pixels) {
    pixels.forEach((c, i) => paintCellLocal(i, c));
}

// 盤面全体を白にする（ローカルUI反映）
function clearLocal() {
    for (let i = 0; i < CELL_COUNT; i++) {
        paintCellLocal(i, "#FFFFFF");
    }
}

// 現在の盤面を配列で取得（data-colorから）
function getPixelsFromDom() {
    const arr = [];
    $(".cell").each((_, el) => {
        arr.push($(el).attr("data-color") || "#FFFFFF");
    });
    return arr;
}

// =============================
// 5) Firebaseへイベント送信
// =============================

function pushEvent(ev) {
    const newRef = push(dbRef);
    return set(newRef, ev);
}

function nowJP() {
    return new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

// =============================
// 6) イベント受信（リアルタイム反映）
// =============================

function handleEvent(ev) {
    if (!ev || !ev.type) return;

    // 1) paint：1マス塗り
    if (ev.type === "paint") {
        paintCellLocal(ev.index, ev.color);
        return;
    }

    // 2) clear：全消し
    if (ev.type === "clear") {
        clearLocal();
        return;
    }

    // 3) applySave：保存配列の一括反映
    if (ev.type === "applySave") {
        if (Array.isArray(ev.pixels) && ev.pixels.length === CELL_COUNT) {
            applyPixelsLocal(ev.pixels);
        }
        return;
    }
}

// 新しい子要素が追加されるたび反映
// 初回起動時には既存のイベントが順番に流れてくる
onChildAdded(dbRef, (data) => {
    const ev = data.val();
    handleEvent(ev);
});

// =============================
// 7) UIイベント
// =============================

// カラーピッカー選択
$("#palette").on("click", ".color-chip", function () {
    $(".color-chip").removeClass("selected");
    $(this).addClass("selected");
    currentColor = $(this).attr("data-color");
});

// 描画マスクリック
$("#grid").on("click", ".cell", function () {
    const index = Number($(this).attr("data-index"));

    // ローカル即反映
    paintCellLocal(index, currentColor);

    // Firebaseへイベント送信
    const ev = {
        type: "paint",
        index,
        color: currentColor,
        time: nowJP()
    };
    pushEvent(ev);
});

// ALL CLEAR
$("#allClear").on("click", function () {
    const ok = confirm("全て削除しますか？");
    if (!ok) return;

    // ローカル即反映
    clearLocal();

    // Firebaseへclearイベント
    const ev = { type: "clear", time: nowJP() };
    pushEvent(ev);
});

// SAVE ▶（保存は1件）
$("#saveBtn").on("click", function () {
    const pixels = getPixelsFromDom();

    // localStorageへ保存
    localStorage.setItem(SAVE_KEY, JSON.stringify(pixels));

    // 右の保存領域に反映
    renderSavePreview(pixels);
});

// 保存領域クリックで復元
$("#savePreview").on("click", function () {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;

    const pixels = JSON.parse(raw);
    if (!Array.isArray(pixels) || pixels.length !== CELL_COUNT) return;

    const ok = confirm("保存した情報で塗り替えますか？");
    if (!ok) return;

    // ローカル反映
    applyPixelsLocal(pixels);

    // Firebaseへ applySave イベント
    const ev = {
        type: "applySave",
        pixels,
        time: nowJP()
    };
    pushEvent(ev);
});

// =============================
// 8) 起動時処理
// =============================
renderPalette();
renderGrid();

// 既存保存があれば右に表示（1件）
const saved = localStorage.getItem(SAVE_KEY);
if (saved) {
    try {
        const pixels = JSON.parse(saved);
        renderSavePreview(pixels);
    } catch {
        renderSavePreview(null);
    }
} else {
    renderSavePreview(null);
}
