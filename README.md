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

## 処理の流れ
────────────────────────────────────────────
図①：起動時の流れ（DOM生成＆受信準備）
────────────────────────────────────────────
[main.js 起動]
   |
   +--> ① 定数/状態を用意
   |       - GRID_SIZE = 8
   |       - CELL_COUNT = 64
   |       - COLORS = [...]
   |       - currentColor = 黒
   |
   +--> ② Firebase 初期化
   |       - initializeApp(firebaseConfig)
   |       - db = getDatabase(app)
   |       - dbRef = ref(db, "pixel_sync/events")
   |
   +--> ③ 受信の仕込み（超重要）
   |       - onChildAdded(dbRef, (data) => handleEvent(data.val()))
   |       ※ 初回は「既存イベント」も順に流れてくる
   |
   +--> ④ UI生成
   |       |
   |       +--> renderPalette()
   |       |       |
   |       |       +--> COLORS.forEach((c, i) => ...)
   |       |              - chip要素を作る
   |       |              - background = c
   |       |              - data-color = c
   |       |              - i==0だけ selected
   |       |              - #palette に append
   |       |
   |       +--> renderGrid()
   |               |
   |               +--> for i = 0..63
   |                      - cell要素を作る
   |                      - data-index = i
   |                      - data-color = 白
   |                      - #grid に append
   |
   +--> ⑤ localStorage 読み込み
           - 保存があれば右の保存領域にプレビュー表示

────────────────────────────────────────────
図②：操作時の流れ（ローカル→Firebase→全員反映）
────────────────────────────────────────────

A) 色チップクリック（色選択）
[ユーザー]
   |
   v
　[.color-chip をクリック]
   |
   v
　[click handler]
   |
   +--> 全チップ selected を外す
   |
   +--> クリックされたチップ = $(this)
   |       |
   |       +--> selected を付ける
   |       +--> data-color を読む
   |       +--> currentColor を更新


B) マスクリック（リアルタイムの核）
[ユーザー]
   |
   v
　[.cell をクリック]
   |
   v
　[index取得]
  - $(this).attr("data-index")
   |
   v
① ローカル即反映
  - paintCellLocal(index, currentColor)
   |
   v
② Firebaseへイベント送信（ログ）
  - pushEvent({
        type: "paint",
        index: index,
        color: currentColor,
        time: ...
    })
   |
   v
③ Realtime DB に新イベントが追加
   |
   v
④ 全ブラウザで onChildAdded 発火
   |
   v
⑤ handleEvent("paint")
  - paintCellLocal(index, color)


C) ALL CLEAR
[ALL CLEAR]
   |
   v
　[confirm "全て削除しますか？"]
   |
   +--> キャンセル：終了
   |
   +--> OK：
         |
         v
     ① ローカルを白に
        - clearLocal()
         |
         v
     ② clearイベントを push
        - { type: "clear", time: ... }
         |
         v
     ③ 全ブラウザ onChildAdded
        - clearLocal()


D) SAVE ▶（保存は1件・ローカルのみ）
[SAVE ▶]
   |
   v
① 盤面の状態を配列化
  - getPixelsFromDom()  // 64色
   |
   v
② localStorage に保存（1件）
  - SAVE_KEY
   |
   v
③ 右の保存領域に縮小表示
  - renderSavePreview(pixels)


E) 保存領域クリック → 復元 → Firebase反映
[保存領域クリック]
   |
   v
[confirm "保存した情報で塗り替えますか？"]
   |
   +--> キャンセル：終了
   |
   +--> OK：
         |
         v
     ① ローカルに一括反映
        - applyPixelsLocal(pixels)
         |
         v
     ② applySaveイベントを push
        - { type: "applySave", pixels: [...], time: ... }
         |
         v
     ③ 全ブラウザ on
