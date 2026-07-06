> **ביקורת בידוד-נתונים (RLS) — מודל רב-דיירי · 2026-07-07**
> נוצרה ע"י workflow קריאה-בלבד: 4 סוקרי-תחום (טבלאות · אחסון · פונקציות-קצה · לקוח-מול-DB) + אימות אדברסרי לכל ממצא + סינתזה. נסקר: `e066c25` + עבודת-הסשן-המקביל בעץ-העבודה. 2 ממצאים גולמיים → **0 אושרו, 2 הופרכו**.

# דוח-בידוד (RLS) לשחרור הרב-דיירי — פסק-דין סופי

## 1. פסק-דין: ready-with-caveats

בידוד-הנתונים הפר-משפחתי **נכתב נכון ומלא בקוד-המקור**. נסרקו כל 34 המיגרציות, כל קריאות ה-DB בלקוח, האחסון, ושש פונקציות-הקצה. **אין ולו ממצא אחד** שבו בן-משפחה יכול לקרוא או לכתוב שורה של בעלים אחר. כל טבלת-נתונים מפעילה RLS עם מדיניות `owner_scoped` הבודקת `owner_id = auth.uid()` בשני הצדדים (`using` + `with check`), המכסה את כל ארבע הפעולות דרך `for all`.

**מדוע לא "ready" מלא, אלא "עם-סייג":** כל הראיות הן סטטיות — מוכיחות שהמדיניות הנכונה **כתובה** במיגרציות, אך תלויות בכך שמיגרציה 026 (מחיקת ה-anon) ומעלה **הוחלו בפועל** על ה-DB המרוחק. כלל-הקריאה-בלבד מנע שליפת `pg_policies` חיה. הסיכון האמיתי היחיד שנותר אינו באגריאלי-קוד אלא תפעולי: אם 026 לא רצה על המרוחק, מדיניות `anon_all` המסוכנת (002) עדיין חיה שם, וכל מחזיק במפתח-anon הציבורי רואה את נתוני כולם. **חובה** להריץ את תוכנית-הוידוא בסעיף 3 לפני השחרור.

## 2. חורים מאומתים מדורגים

**אין חורי-בידוד מאומתים.** רשימת-הממצאים ריקה במכוון — כל ארבעת מימדי-הסקירה (table-rls, storage-rls, edge-service-role, client-vs-db) התכנסו ל-findings ריק, ואימות עצמאי מול המקור אישר זאת.

הראיה החזקה שהבידוד **DB-אכיף ולא לקוח-אכיף**: מספר נתיבי מחיקה/עדכון בלקוח מסננים לפי `id` בלבד, ללא `owner_id` — `deleteLoan` (useLoansData.ts:121), `deleteMortgageTrack` (useMortgageData.ts:147), `deleteInvestmentCost` (useInvestmentData.ts:116), `updateProperty`/`updateContract`/`deleteContract` (usePropertyData). אלה בטוחים **אך ורק** מפני שה-DB מחיל `owner_scoped USING(owner_id=auth.uid())` שהופך שורת-זולת לבלתי-נראית ובלתי-ניתנת-לשינוי. זו בדיוק ההוכחה שהבידוד יושב ב-DB, לא בלקוח.

נקודות שנבדקו ואומתו כתקינות (לא-דליפות):
- **owners** (migration 006): `owner_scoped` עם `id=auth.uid()`. יצירת-שורה ב-`AuthContext.ts:27` עושה `upsert({id: userId})` מה-session בלבד; ה-`with check (id=auth.uid())` חוסם זיוף id של אחר.
- **mortgage_tracks** (011:19,33): נושאת `owner_id` משלה ומגודרת ישירות עליו — **אין join שיכול לדלוף**. זו הייתה חשד-שרשרת-הבת המרכזי, ונסגר.
- **contract_utilities** (006:32-39): חסרת owner_id, מגודרת דרך תת-שאילתה `contract_id in (select id from contracts where owner_id=auth.uid())` — contract_id מזויף אינו בקבוצה המותרת. אטום.
- **push_log** (025) ו-**reminder_log** (029): RLS מופעל **ללא שום מדיניות** = דחייה מלאה לכל לקוח; רק service-role נוגע. תקין.
- **feedback** (027/031): קריאה חוצת-משתמשים למנהל `dev@test.local` בלבד — חריג-מנהל **מכוון**. תביעת ה-email ב-JWT נקבעת ע"י Supabase Auth ואינה ניתנת-לזיוף ע"י בן-משפחה.
- **אחסון**: שני דליים (`documents`, `feedback`) מגודרים ל-`(storage.foldername(name))[1] = auth.uid()::text` ל-INSERT/SELECT/DELETE. UPDATE חסום (default-deny) — חסימה, לא פרצה. דלי-feedback מופרד מ-documents כדי שקריאת-המנהל לא תיגע במסמכים פיננסיים.
- **לקוח**: `supabase.ts:4` — anon key בלבד; grep על service_role/auth.admin/getUserById/listUsers בכל src = 0.

### הערה תצורתית (לא-בידוד, לא-חוסם)
מיגרציה 031 העבירה את מנהל-המשוב ב-DB ל-`dev@test.local`, בעוד `notify-feedback` פותרת את **נמען-הפוש** ל-`itai.shubi@gmail.com`. **הבהרה:** זו החלטה מכוונת של הבעלים — התראת-הפוש על משוב חדש אמורה להגיע לטלפון האישי, בעוד סקירת-המשוב נעשית מקונסולת-המנהל. אין כאן חשיפת-נתונים ואין מה לתקן.

## 3. תוכנית-וידוא-חי (חובה לפני שחרור)

הבעלים יריץ עם **שני חשבונות-Google אמיתיים** (משתמש A ומשתמש B), ובנוסף בדיקת-DB ישירה. המטרה: להוכיח שמיגרציה 026+ אכן הוחלה ושהבידוד חי.

### שלב 0 — בדיקת-DB ישירה (הכי חשוב; מוכיח ש-026 רצה)
מול ה-DB המרוחק (SQL Editor בקונסולת Supabase או `psql`):
```sql
-- אסור שתחזור אף שורה. כל שורה כאן = פרצה קריטית (anon_all/authenticated_all/using(true) חיה).
select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and (roles::text like '%anon%' or qual = 'true' or policyname in ('anon_all','authenticated_all'));

-- ודא ש-RLS מופעל בכל טבלת-נתונים (rowsecurity חייב = true לכולן):
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- ודא שלכל טבלה יש owner_scoped עם auth.uid():
select tablename, policyname, qual, with_check
from pg_policies where schemaname='public' and policyname='owner_scoped'
order by tablename;

-- אחסון: ודא שאין anon_upload/read/delete, ושה-auth_*/feedback_shot_* קיימות:
select policyname, cmd, qual from pg_policies
where schemaname='storage' and tablename='objects' order by policyname;
```

### שלב 1 — בדיקת-קריאה חוצת-בעלים (הליבה)
כמשתמש A (מחובר), צור נתון בכל טבלה: דירה, חוזה, תנועה, משימה, משכנתא+מסלול, הלוואה, פוליסת-ביטוח, עלות-השקעה, מסמך. רשום את ה-UUID של אחת השורות (למשל חוזה).

התנתק, התחבר כמשתמש B, ובקונסול הדפדפן הרץ לכל טבלה:
```js
await supabase.from('contracts').select()        // חייב 0 שורות
await supabase.from('properties').select()       // חייב 0 שורות
await supabase.from('transactions').select()     // חייב 0 שורות
await supabase.from('tasks').select()            // חייב 0 שורות
await supabase.from('mortgages').select()        // חייב 0 שורות
await supabase.from('mortgage_tracks').select()  // חייב 0 שורות  ← בדיקת-הבת הקריטית
await supabase.from('loans').select()            // חייב 0 שורות
await supabase.from('insurance_policies').select() // חייב 0 שורות
await supabase.from('investment_costs').select() // חייב 0 שורות
await supabase.from('documents').select()        // חייב 0 שורות
await supabase.from('contract_utilities').select() // חייב 0 שורות
await supabase.from('push_log').select()         // חייב 0 שורות (RLS ללא מדיניות)
await supabase.from('reminder_log').select()     // חייב 0 שורות
```
**כל תוצאה != 0 = כשל-בידוד קריטי.**

### שלב 2 — קריאה-ממוקדת-UUID (עוקף סינון-לקוח)
כמשתמש B, נסה למשוך את השורה של A לפי ה-UUID שרשמת:
```js
await supabase.from('contracts').select().eq('id','<UUID-של-A>')  // חייב 0 שורות
```
זה מוכיח שהבידוד ב-DB ולא רק בסינון-הלקוח.

### שלב 3 — כתיבה/מחיקה חוצת-בעלים (חייבת להיכשל)
כמשתמש B:
```js
await supabase.from('contracts').update({rent_amount: 99999}).eq('id','<UUID-של-A>')  // 0 שורות מושפעות
await supabase.from('contracts').delete().eq('id','<UUID-של-A>')                       // 0 שורות מושפעות
await supabase.from('transactions').insert({owner_id:'<UUID-של-A>', amount: 1})        // חייב להיכשל (with check)
```

### שלב 4 — בידוד-אחסון חוצת-בעלים
כמשתמש A העלה מסמך; רשום את הנתיב `{A_uid}/docs/...`. כמשתמש B:
```js
await supabase.storage.from('documents').list('<A_uid>')                    // חייב ריק/שגיאה
await supabase.storage.from('documents').createSignedUrl('<A_uid>/docs/x', 60) // חייב להיכשל
await supabase.storage.from('documents').upload('<A_uid>/docs/hack.txt', blob) // חייב להיכשל (with check)
```
חזור על אותו דבר לדלי `feedback`.

### שלב 5 — חריג-המנהל (ודא שהוא מכוון ותוחם)
התחבר כ-`dev@test.local`, ודא שרואה feedback של כולם. התחבר כמשתמש-משפחה רגיל, ודא שרואה **רק** feedback משלו (`supabase.from('feedback').select()` מחזיר רק שורות שלו).

## 4. מטריצת-בידוד (טבלה → מבודדת ל-4 הפעולות)

| טבלה / דלי | SELECT | INSERT | UPDATE | DELETE | הערה |
|---|---|---|---|---|---|
| owners | כן | כן | כן | כן | id=auth.uid (006) |
| properties | כן | כן | כן | כן | owner_scoped (006) |
| contracts | כן | כן | כן | כן | owner_scoped (006) |
| contract_utilities | כן | כן | כן | כן | דרך תת-שאילתת contracts (006) |
| recurring_items | כן | כן | כן | כן | owner_scoped (006) |
| transactions | כן | כן | כן | כן | owner_scoped (006) |
| tasks | כן | כן | כן | כן | owner_scoped (006) |
| documents | כן | כן | כן | כן | owner_scoped (006) |
| investment_costs | כן | כן | כן | כן | owner_scoped (010) |
| mortgages | כן | כן | כן | כן | owner_scoped (011) |
| mortgage_tracks | כן | כן | כן | כן | owner_id עצמאי, ללא join (011) |
| insurance_policies | כן | כן | כן | כן | owner_scoped (014) |
| loans | כן | כן | כן | כן | owner_scoped (018) |
| push_subscriptions | כן | כן | כן | כן | owner_scoped (025) |
| push_log | חסום | חסום | חסום | חסום | RLS ללא מדיניות = דחייה מלאה (025) |
| reminder_log | חסום | חסום | חסום | חסום | RLS ללא מדיניות = דחייה מלאה (029) |
| feedback | כן* | כן | חסום | כן* | *own; מנהל dev@test.local רואה/מוחק הכול — מכוון (027/031) |
| storage: documents | כן | כן | חסום | כן | foldername[1]=auth.uid (006) |
| storage: feedback | כן* | כן | חסום | כן* | *own; מנהל רואה/מוחק הכול — מכוון (034) |

*"כן" = מבודד נכון (הפעולה מגודרת ל-owner-עצמו). "חסום" = הפעולה נדחית לחלוטין לכל לקוח (בידוד מקסימלי).*

**כל התאים = כן/חסום. אין ולו תא "לא" או "לא-ידוע" ברמת-הקוד.** ה"לא-ידוע" היחיד הוא מטא: האם המצב-החי תואם את הקוד (סעיף 5).

## 5. מה שלא ניתן לאמת סטטית — דורש ריצה-חיה

1. **החלת-המיגרציות בפועל על ה-DB המרוחק** — הסייג המרכזי. הקוד מוכיח שהמדיניות **כתובה**, לא ש**הוחלה**. אם 026 לא רצה, `anon_all` (002) חי והכול דלוף. → שלב 0 + שלב 1.
2. **מדיניות/טבלאות שנוצרו מחוץ למיגרציות** (דרך קונסולת-Supabase ידנית) — לא נראות בקבצי-המקור. → `pg_policies` בשלב 0.
3. **פיגור schema-cache / עריכה ידנית** של המצב-החי. → בדיקת-DB ישירה.
4. **התנהגות-הבידוד בפועל תחת UUID-מזויף** (קריאה/כתיבה/מחיקה/אחסון חוצי-בעלים) — נבדק סטטית שהמדיניות תחסום, אך רק ריצה חיה מוכיחה זאת מקצה-לקצה. → שלבים 2-4.
5. **חריג-המנהל בפועל** — שהמנהל אכן רואה-הכול ובן-משפחה רואה-רק-שלו. → שלב 5.
6. **ביקורת-אבטחה מלאה של פונקציות-הקצה מול קלט זדוני** — נבדקה רק ברמת-חשיפת-נתונים חוצת-בעלים (נקי), לא כביקורת-אבטחה מקיפה.

---

## נספח — 2 הממצאים שהופרכו (הקשחה עתידית, לא-חוסמים)

1. **אין מדיניות UPDATE על `storage.objects`** בשני הדליים. עם `upsert:true` (storage.ts:30,40,51), העלאה-חוזרת לנתיב-קיים-של-הבעלים-עצמו עלולה להיכשל בשקט. **זו דלת-סגורה (חוסמת גם את הבעלים), לא פרצה** — הנתיבים מבוססי-UUID אקראי אז התנגשות נדירה. הקשחה תפעולית מומלצת: הוסף מדיניות `UPDATE` מגודרת ל-`auth.uid()` בשני הדליים כדי ש-upsert חוקי-של-הבעלים יעבוד.
2. **ענף-האדמין של דלי feedback מגודר לפי טענת-אימייל בטוקן** (`dev@test.local`) ולא לפי UID קבוע. **לא ניתן-לזיוף ע"י בן-משפחה** (GoTrue מנפיק את טענת-האימייל שרת-צד). הקשחה עתידית: גדר לפי UID קבוע של המנהל במקום ערך-אימייל שעשוי להשתנות.
