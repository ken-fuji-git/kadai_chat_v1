# ①課題名
PIXEL SYNC

## ②課題内容（どんな作品か）
ピクセルお絵かきのリアルタイム共有ページ

## ③アプリのデプロイURL
https://ken-fuji-git.github.io/kadai_chat_v1/

## ⑤工夫した点・こだわった点
当初は画像のやりとりができるように考えていたものの、かなりハードルが高いことがわかり、ピクセルお絵かきの方にシフトしました。
最初にワイヤーフレームで必要な要素を書き出し、それをもとにChatGPTと壁打ち。
リアルタイムの描画エリアはFirebaseでのデータやりとりで実現し、
さらに気に入った画像を自身のlocal storageに保存し、いつでも反映できるようにしました。

加えて今回はUIの生成をJSを使ってチャレンジしました。
色を増やす/減らす/並び替える作業が簡単になるという事だったので、実際に触ってみると、
確かにカラーパレット部分の修正が簡単にできるようになりました。
その分クリックイベントではイベント委譲が必要になってくるなど面倒な事もあるという事がわかりました。
`$("#palette").on("click", ".color-chip", ...)`
のように。（親にイベントをつける！）

## ⑥難しかった点・次回トライしたいこと（又は機能）
Firebaseとlocal storage を併用した事で、データの取り扱いがぐちゃぐちゃになりました。
毎回READMEにかける時間がなくなってしまうので、次回はもっと親切なREADMEを作りたいと思います。

## ⑦フリー項目（感想、シェアしたいこと等なんでも）
いつもだったら途中で考えが散らかって収集がつかなくなるのですが、ワイヤーフレームを作った事で最後まで方針が振れずに対応できたと思います。設計は大事だと痛感しました。

## 起動時メモ（DOM生成と監視開始）
┌─────────────────────────────────────────────┐
│                 起動（main.js）              │
└─────────────────────────────────────────────┘
    │
    ├─ ① 定数・状態を用意
    │     COLORS / GRID_SIZE / currentColor など
    │
    ├─ ② Firebase初期化
    │     initializeApp()
    │     getDatabase()
    │     dbRef = ref(db, "pixel_sync/events")
    │
    ├─ ③ 受信の仕込み（ここ超大事）
    │     onChildAdded(dbRef, ...)
    │
    ├─ ④ UI生成
    │
    │   ┌───────────────────────────┐
    │   │ renderPalette()            │
    │   └───────────────────────────┘
    │            │
    │            │  COLORS.forEach((c, i) => ...)
    │            ▼
    │      色チップDOMを8個作る
    │      ・背景色 = c
    │      ・data-color = c
    │      ・i===0だけ selected
    │            │
    │            ▼
    │       #palette に append
    │
    │   ┌───────────────────────────┐
    │   │ renderGrid()               │
    │   └───────────────────────────┘
    │            │
    │            │  for i=0..63
    │            ▼
    │      マスDOMを64個作る
    │      ・data-index = i
    │      ・data-color = "#FFFFFF"
    │            │
    │            ▼
    │       #grid に append
    │
    └─ ⑤ localStorage読込
            あれば保存プレビューを表示

## 操作時メモ（ローカル反映 → Firebase → 全員に反映）

### A) 色チップをクリックした時
ユーザーが色チップをクリック
        │
        ▼
#palette に付けた click が反応（イベント委譲）
  $("#palette").on("click", ".color-chip", ...)
        │
        ▼
クリックされた要素 = $(this)
        │
        ├─ 全チップの selected を外す
        ├─ クリックチップに selected を付ける
        └─ currentColor = $(this).attr("data-color")

### B) 盤面のマスをクリックした時（リアルタイムの核）
ユーザーがマスをクリック
        │
        ▼
index を取得（data-index）
        │
        ▼
① ローカル即反映
   paintCellLocal(index, currentColor)
        │
        ▼
② Firebaseへイベント送信（ログ型）
   pushEvent({
     type:"paint",
     index,
     color: currentColor
   })
        │
        ▼
③ Realtime DBに新しい子要素が追加
        │
        ▼
④ onChildAdded が全ブラウザで発火
   （自分のブラウザも含む）
        │
        ▼
⑤ handleEvent("paint")
   → paintCellLocal(index, color)

### ALL CLEAR
ALL CLEAR クリック
        │
        ▼
confirm("全て削除しますか？")
        │
   OK ──┘
        │
        ▼
① ローカルを白に
   clearLocal()
        │
        ▼
② clearイベントを push
   { type:"clear" }
        │
        ▼
③ 全ブラウザ onChildAdded → clearLocal()

### D) SAVE
SAVE ▶ クリック
        │
        ▼
① 盤面64色を配列化
   getPixelsFromDom()
        │
        ▼
② localStorage に保存（1件）
   SAVE_KEY
        │
        ▼
③ 右の保存領域に縮小表示

### E) 保存領域クリック → 復元 → Firebaseにも反映
保存領域クリック
        │
        ▼
confirm("保存した情報で塗り替えますか？")
        │
   OK ──┘
        │
        ▼
① ローカルに一括反映
   applyPixelsLocal(pixels)
        │
        ▼
② applySaveイベントを push
   { type:"applySave", pixels:[...] }
        │
        ▼
③ 全ブラウザ onChildAdded → applyPixelsLocal
