# 遊戲中心 gamecenter — 新遊戲開發指南

作者：Carinoasd · (C) 2026 Carinoasd

平台負責帳號、開局憑證、交成績、排行榜（日／週／總）、積分獎勵、週榜結算、成績視窗。
**一款遊戲只要寫前台的玩法**，不用碰資料庫、不用改平台的任何檔案。

---

## 1. 最快上手（5 分鐘）

1. 複製 `games/_example/` 成 `games/<識別碼>/`。
   識別碼規則：小寫英文字母開頭，只能有小寫英文、數字、底線，2～32 字（例如 `tetris`、`flappy_bird`）。
   底線開頭的資料夾（像 `_example`）平台不會登記。
2. 改 `game.json` 的名稱、簡介；把 `game.js` 裡的 `GameCenter.register('_example', …)` 改成你的識別碼。
3. 後台「插件 → 游戏中心 → 遊戲管理」按 **重新掃描 games/ 資料夾**。
4. 新遊戲預設**不開放**；管理員點名稱就能試玩（成績照記，方便測試）。測好了勾「開放」並儲存。

---

## 2. 資料夾內容

```
games/<識別碼>/
  game.json     必要：遊戲資訊
  game.js       必要：前台玩法（檔名可在 game.json 的 script 改）
  verify.php    選用：伺服器校驗（有它才算「成績服務器校驗」，要發積分強烈建議寫）
  rules.php     聯機對戰遊戲必要：規則（見 5b）
  icon.svg      選用：大廳圖示（svg/png/jpg/gif/webp）
  style.css     選用：遊戲自己的樣式（在 game.json 的 style 指定）
  index.htm     建議放一個空檔，防止列目錄
```

### game.json

| 鍵 | 必要 | 說明 |
|---|---|---|
| `name` | ✔ | 遊戲名稱（前台照站台語言，TSDM 用简体） |
| `intro` |  | 一句話簡介（大廳卡片） |
| `help` |  | 玩法說明（遊戲頁下方） |
| `version` |  | 版本，會加在 js/css 網址後面避免快取；改版記得改 |
| `author` |  | 作者，顯示在後台 |
| `order` |  | `desc`＝分數越高越好（預設）；`asc`＝越低越好（例如計時賽，存毫秒） |
| `unit` |  | 分數單位：`分`、`秒`、`毫秒`… |
| `script` |  | 前台腳本檔名，預設 `game.js` |
| `style` |  | 遊戲樣式檔名（`*.css`） |
| `icon` |  | 圖示檔名 |
| `displayorder` |  | 第一次登記時的排序，之後以後台設定為準 |
| `replay` |  | `true`＝支援幽靈挑戰與每日挑戰（要有 verify.php，見第 5 節） |
| `room` |  | 聯機對戰（見 5b）：`true` 或 `{players, turn_ms, wait_ms, rating}`，要有 `rules.php` |
| `ttl` |  | 開局後幾小時內要交成績（1～168，預設 2；長局用，見 5d） |

分數一律是**整數**。

---

## 3. 前台介面（game.js）

頁面會先載入平台的 `static/gc.js`，再載入你的腳本。在腳本裡註冊：

```js
GameCenter.register('<識別碼>', function (stage, api) {
  // stage：遊戲的容器 <div>，把畫面放進去（寬度隨版面，手機也會用到）
  // api.best    這位會員的歷史最佳（沒玩過／遊客＝null）
  // api.mobile  是否觸控裝置
  // api.visible(el)  el 是否在畫面內（可用來判斷空白鍵要不要攔）
  // api.uid     目前會員 UID（遊客 0）
  // api.rivals  本週排行前 50 名 [{u: uid, n: 用戶名, s: 分數}]，交成績後平台自動更新（可做「再 N 分超過某某」）

  api.start().then(function (info) {
    if (!info) return;          // 開不了局（平台已經跳出原因）
    // info.seed   1～2147483646 的亂數種子：遊戲裡的亂數請全部從它算，伺服器才能重播
    // info.guest  1＝遊客／沒有權限：照樣可以玩，只是不會記成績
    // info.token  一次性憑證（平台自己用，不用管）
  });

  // 遊戲結束時：
  api.submit(info, { score: 123, /* 其他重播資料 */ }, '游戏结束');
  // → 平台送出成績、顯示成績視窗（分數、新紀錄、本週名次、獎勵）、刷新右側排行榜
  //   回傳 Promise<{ok, score, best, newbest, rank, reward, rewardtext, rivals, msg}>
});
```

規則：

- **每局開始一定要先 `api.start()`**，一個 token 只能交一次成績，開局後 2 小時內要交。
- `submit` 的第二個參數是物件，值必須是字串或數字（會以表單送出，總長上限約 600KB）。
- 不要用 `alert`；需要提示就在 `stage` 裡自己畫。成績視窗由平台負責。
- 鍵盤事件記得排除輸入框（參考 `games/snake/game.js`），也不要攔截頁面其他地方的空白鍵。
- 共用樣式可直接用：按鈕 `class="gc-btn"`（次要按鈕再加 `gc-ghost`）。
- 分頁切走時建議自動暫停（`visibilitychange`）。

---

## 4. 伺服器校驗（verify.php）

沒有 verify.php 的遊戲，分數是瀏覽器說了算，懂一點的人能直接送假分數。
後台只能用「分數上限」擋住誇張值。**要發積分的遊戲請寫 verify.php。**

做法是「決定性重播」：遊戲邏輯只依賴 `info.seed` 與玩家輸入，前台把輸入紀錄送上來，伺服器用同一套規則重算一遍。

```php
<?php
if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_verify_<識別碼> {

	/**
	 * $seed：開局時發給前台的種子
	 * $data：前台 submit 的第二個參數（每個值都是字串）
	 * 回傳：
	 *   ['ok' => 1, 'score' => 伺服器算出的分數, 'minms' => 這局最少要花幾毫秒（選填）]
	 *   ['ok' => 0, 'reason' => '給玩家看的原因（简体）']
	 */
	public static function verify($seed, array $data) {
		...
	}
}
```

- 記錄進排行的是 verify 回傳的 `score`，不是前台送的。
- `minms`：平台會比對「開局到交成績實際經過的時間」，比 `minms` 的 85% 再少 1.5 秒就退回（防加速外掛）。
- 亂數建議用 Park–Miller（JS 與 PHP 都不會溢位、結果完全一致）：
  `s = s * 48271 % 2147483647`
- 不要在重播裡用浮點數比較位置；用整數格子或固定小數。
- 設好上限（最多幾步、輸入紀錄最多幾筆），避免有人送超大資料拖慢伺服器。
- 規則改版時在 submit 資料帶版本號（贪食蛇用 `v`），verify 不認得的版本就回「请重新整理页面」，
  避免改版當下還開著舊頁面的人交上來被當成作弊。
- 完整例子：`games/snake/verify.php`（與 `game.js` 規則逐條對照）。

---

## 5. 支援幽靈挑戰與每日挑戰（1.2.0 起，選用）

條件：有 `verify.php`（伺服器重播），並在 `game.json` 加 `"replay": true`。平台就會：

- 把刷新排行最佳的那一局（`submit` 送的資料原樣）存成重播，排行榜列上出現 ⚔；
- 點 ⚔ → 遊戲頁網址帶 `&ghost=<重播 id>`，`api.start()` 用**那一局的種子**開局，並在回傳的 `info.ghost` 給你對手資料；
- 每日挑戰（`&mode=daily`）→ `api.start()` 給的是**當天全站同一顆種子**，`info.daily = {try, tries}`；
- 成績視窗、勝負紀錄、通知對方、回敬、次數限制、挑戰榜、結算都由平台處理。

遊戲要做的只有「把對手畫出來」：

```js
api.start().then(function (info) {
  if (!info) return;
  // info.mode：'' 一般／'daily' 每日挑戰／'ghost' 幽靈挑戰（也可以讀 api.mode）
  if (info.ghost) {
    // info.ghost = { rid, uid, name, score, data }
    // data 就是對手當時 submit 的資料（例如贪食蛇的 {v, score, ticks, moves}）
    // 用 info.seed（＝對手那局的種子）跑一份同樣的遊戲邏輯，照 data 重播，畫成半透明。
  }
});
```

建議把遊戲規則寫成「給種子＋輸入 → 狀態」的獨立物件（贪食蛇的 `Sim`），玩家和幽靈各跑一份，
規則只寫一次，也不會跟 `verify.php` 走鐘。幽靈的計時器回呼不要跟玩家的同名。

挑戰局與每日挑戰局都不進一般排行、不發每局積分（同一張地圖可以反覆練，不公平）；
每日挑戰在自己當天次數用完前，看不到當天別人的每日挑戰重播。

---

## 5b. 聯機對戰遊戲（1.4.0 通用房間）

game.json 加 `"room": true`（或 `{"players": 2, "turn_ms": 60000, "wait_ms": 300000, "rating": true}`）的遊戲是**聯機對戰**。
平台負責：開房、房間號／邀請連結加入、**自動配對**、狀態同步（輪詢）、回合限時與逾時判定、重送去重、認輸、**Elo 等級分**、對局紀錄與**回放**。
聯機遊戲沒有單機的 `api.start`／`api.submit`、不進排行、不發積分，後台的積分設定對它無效。

### 要寫的兩個檔

**`rules.php`** — 規則，跑在伺服器，勝負只看它：

```php
<?php
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }

class gamecenter_rules_<識別碼> extends gamecenter_rules {
	const PLAYERS = 2;        // 幾人一局（2～4）
	const TURN_MS = 60000;    // 每回合限時
	const WAIT_MS = 300000;   // 等人加入的時限
	const RATING = true;      // 算等級分（只有 2 人遊戲會算）

	/** 開局狀態（陣列，一定要有 'turn' => 先手座位 1）。$seed 是這一局的亂數種子（發牌、擲骰用它算）。 */
	public static function init($seed, $players) { return ['b' => …, 'turn' => 1]; }

	/**
	 * 座位 $seat 送來一步 $payload（前台 api.room.move() 的物件，≤ 2KB）。
	 * 回傳新狀態（記得更新 'turn'）；結束時加 'over' => 1、'winner' => 座位（0＝和棋）、'reason' => 原因字串。
	 * 不合法回傳錯誤碼字串：'cell'（位置不能下）、'rules'（不符規則）、'input'（資料不對）。
	 */
	public static function move($state, $seat, $payload, $seed) { … }

	/** 選用：某座位超時。預設＝這一位判負（2 人）。 */
	public static function timeout($state, $seat) { … }

	/** 選用：給某座位看的狀態（有隱藏資訊的遊戲，例如手牌：把別人的牌拿掉；$seat 0＝旁觀／回放）。預設原樣。 */
	public static function view($state, $seat) { return $state; }
}
```

**`game.js`** — 只畫狀態、送意圖：

```js
GameCenter.register('<識別碼>', function (stage, api) {
  var R = api.room;                 // 聯機遊戲才有
  R.on('update', function (room) {  // 房間變了（自己操作、對手動作、輪詢、結束）；room 為 null＝沒有房間
    // room = { code, status(0 等人/1 進行中/2 結束/3 取消), players:[{seat,uid,name}], me(我的座位), turn,
    //          state(rules 的狀態，經 view()), version, winner(uid), winner_seat, reason, deadline_ms, ratings }
  });
  R.on('queue', function (q) { /* q = {waiting} 在配對佇列；null＝離開佇列 */ });
  R.on('note', function (text) { /* 平台的提示文字（錯誤、重試） */ });
  R.on('busy', function (b) { /* 請求進行中 */ });
  R.create(); R.join(code 或邀請連結); R.match(); R.cancelMatch();
  R.move({ cell: 12 });             // 只有 R.myTurn() 時有效；payload 原樣交給 rules::move()
  R.resign(); R.retry(); R.refresh();
  R.history().then(list);           // 最近 10 局
  R.replay(code).then(r);           // r.moves = [{seat, data, ms}]，r.room；結束的局誰都能看
  R.room / R.seat / R.myTurn() / R.active() / R.pending() / R.serverNow() / R.link(code)
});
```

平台會：網址帶 `&room=代碼` 時自動加入；每 2 秒輪詢（出錯退避到 15 秒）、分頁切到背景就停；同一步重送用同一個 request_id，伺服器只接受一次；每人同時只能有一間進行中的房間。
例子：`games/reversi/`（黑白棋，規則 60 行、介面 110 行）、`games/gomoku/`。

### 自動配對與等級分
- 「自動配對」把人放進該遊戲的佇列，湊滿 `PLAYERS` 人就直接開一間進行中的房；先排的人先手。
- 等級分：Elo，初始 1500，K＝32，和棋各半；只有分出勝負（含認輸、超時）的 2 人對局計分。大廳卡片、遊戲頁右欄、`&mod=rank` 都是等級分榜；後台「聯機對局」可清空某遊戲的等級分。

---

## 5c. 伺服器存檔（1.4.0）

長局或關卡制遊戲用：每位會員每款遊戲 3 個存檔格（0～2），每格 ≤ 64KB JSON，180 天沒更新會清掉。

```js
api.save({ level: 3, hp: 20 }, 0).then(r => r.ok);   // 存
api.load(0).then(s => s && s.data);                 // 讀：{data, dateline} 或 null
api.clearSave(0);
```

存檔內容是玩家自己的瀏覽器送上來的，**不能當成績依據**。要計分的長局請把操作紀錄一起存進存檔，結束時照樣走 `api.start()`／`verify.php`（或用下面的分段提交）。遊客沒有存檔。

## 5d. 長局：分段提交與交成績期限（1.4.0）

- `game.json` 加 `"ttl": 24`（小時，1～168，預設 2）：開局後多久內要交成績。
- 操作紀錄很長時，不必等到結束一次送：

```js
api.checkpoint(info, piece);   // piece 是字串（例如這一段的操作紀錄），平台自動編號；最多 100 段、每段 ≤ 600KB
api.submit(info, { score, … });
```

伺服器在 `verify()` 時把所有段照順序放進 `$data['_chunks']`（字串陣列），最後 `submit` 的資料照舊在 `$data` 其他鍵。交完成績分段資料就刪。

## 5e. 成績附加資料（1.4.0）

`submit` 可帶 `stats`（物件，≤ 500 字 JSON，例如 `{关卡: 7, 用时: "3:21"}`），會顯示在「我的紀錄」與後台成績紀錄。有 `verify.php` 的遊戲請在 `verify()` 回傳 `'stats' => [...]`，以伺服器算的為準。

## 5f. 資源規範

- 圖、音效、關卡檔放在 `games/<識別碼>/` 底下，從 `game.js` 用相對於站台根目錄的路徑載入（`source/plugin/gamecenter/games/<識別碼>/assets/…`）。**不要用外部 CDN**（正式站使用者多在中國，外部資源常載不到）。
- 改版時 `game.json` 的 `version` 要加，平台會把它加在 js／css 網址後面換快取；自己載入的資源也請帶 `?v=`。
- 單檔建議 ≤ 2MB、整個遊戲 ≤ 20MB；音效預設關閉；手機要能玩（觸控、寬度隨容器）。

---

## 6. 平台已經幫你做的事

| 項目 | 說明 |
|---|---|
| 帳號 | 論壇帳號；遊客試玩、不記成績、成績視窗提示登入 |
| 權限 | 後台可限制哪些用戶組能上排行、哪些用戶組不發獎勵 |
| 開局頻率 | 每人 10 分鐘最多開 30 局 |
| 排行 | 每人每個區間只留最佳；同分先達成的在前 |
| 每局獎勵 | 後台設定積分種類、每 N 分 1 點、單局上限、每天上限 |
| 週榜獎勵 | 後台填「100,50,30」＝前三名；下一週自動結算、發站內提醒、每週只發一次 |
| 管理 | 後台可看每局成績、刪作弊成績並自動重算排行、清空排行 |
| 挑戰 | 重播儲存與過期清理、幽靈挑戰勝負與通知、每日挑戰種子與次數、挑戰榜與結算（1.2.0） |
| 聯機 | 房間、配對、同步、限時、去重、等級分、回放、逾時清理（1.4.0） |
| 長局 | 伺服器存檔、分段提交、可調的交成績期限、成績附加資料（1.4.0） |

---

## 7. 發布檢查表

- [ ] `game.json` 是合法 JSON，`name` 有填
- [ ] `GameCenter.register` 的識別碼跟資料夾名稱一樣
- [ ] 每局都先 `api.start()`、結束只 `submit` 一次
- [ ] 遊客也能玩（`info.guest` 時照樣能開始）
- [ ] 手機能玩（觸控、版面寬度）
- [ ] 有 verify.php 的話：故意改分數送出會被退回、正常玩不會誤判
- [ ] 改版時 `version` 有加
- [ ] 有 `"replay": true` 的話：用排行榜上的 ⚔ 挑戰一次，幽靈的動作跟原本那局一致（照理會剛好撞在同一步）
- [ ] 聯機遊戲：兩個帳號對一局、重新整理能恢復、不是自己的回合送步會被拒、超時判負、回放看得到
