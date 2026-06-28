# מודל-נתונים — "ניהול דירה" (Supabase / Postgres)
(מאומת מ-32 מיגרציות + `src/types/index.ts`.)

## איך לקרוא
לכל טבלה: מה היא מייצגת בעולם האמיתי, השדות העיקריים, והקשרים. כל הנתונים בבעלות משתמש — ראו "מודל-בעלות" בסוף (זה החלק הקריטי).

## הטבלאות
- **owners** — בעלים (משתמש). שדות: `id`, `name`, `email`. שורש-הבעלות.
- **properties** — הדירה. `address`, `purchase_price`, `purchase_date`, `key_delivery_date`, `property_size_sqm`, `floor`, `rooms`, `estimated_value` (שווי-נוכחי משוער), `block_parcel`, `notes`. קשור ל-owners.
- **contracts** — חוזה-שכירות. `company_name` (השוכר), איש-קשר, `start_date`/`end_date`, `monthly_rent`, `deposit`, `payment_method`, `requires_approval`, `renewal_alert_days[]`. קשור ל-properties + owners.
- **contract_utilities** — מי משלם כל שירות (ארנונה/מים/חשמל/ועד). `utility`, `payer` (שוכר/בעלים), `amount`. קשור ל-contracts (ללא `owner_id` משלו).
- **recurring_items** — תבנית הכנסה/הוצאה חוזרת (שכר-דירה, משכנתא, ביטוח). `direction`, `amount`, `category`, `day_of_month`, `start_date`/`end_date`, `payee`, `execution_type` (אוטומטי / דורש-אישור). מייצרת תנועות ומשימות. קשור ל-owners + contract (אופציונלי).
- **transactions** — תנועה בודדת (הכנסה/הוצאה) אמיתית. `direction`, `amount`, `date`, `category`, `description`, `payment_method`. קשור ל-owners, ואופציונלי ל-contract / recurring_item / document.
- **tasks** — משימה/תזכורת. `title`, `due_date`, `due_time`, `category`, `status` (פתוח/בוצע), `source` (ידני / חוזר / חידוש), `is_recurring`, `completed_at`, `google_task_id`. קשור ל-owners, ואופציונלי ל-property / recurring_item / transaction.
- **documents** — קובץ. `type` (חוזה-רכישה / חוזה-שכירות / פוליסה / דף-משכנתא / דף-הלוואה / קבלה / חשבונית / אחר), `name`, `storage_path`, `date`. קשור ל-owners, ואופציונלי ל-property / contract / transaction / task. הקבצים באחסון Supabase, בתיקייה לפי מזהה-המשתמש.
- **investment_costs** — עלות-השקעה / הון. `category`, `label`, `amount`, `notes`. מייצג עלויות-רכישה והון עצמי.
- **mortgages** — חשבון-משכנתא (מעטפת). `lender`, `notes`. קשור ל-property + owners. הפירוט במסלולים.
- **mortgage_tracks** — מסלול-משכנתא. `track_type` (פריים / קבועה-לא-צמודה / קבועה-צמודה / משתנה), `principal`, `annual_rate` (ריבית אפקטיבית), `prime_rate`+`margin` (למסלולי פריים/משתנה), `term_months`, `grace_months`, `start_date`. קשור ל-mortgages + owners. (משכנתא אחת = כמה מסלולים.)
- **loans** — הלוואה משלימה / בלון. `repayment_type` (חודשי-קבוע / בלון); לחודשי-קבוע: `track_type`, `annual_rate`, `term_months`, `grace_months` (לוח שפיצר); בלון = סכום שנפרע רק במכירה. קשור ל-property + owners.
- **insurance_policies** — פוליסת-ביטוח. `type`, `company`, `policy_number`, `monthly_premium`, `start_date`/`end_date`. קשור ל-property + owners.
- **push_subscriptions** — מנוי-התראות לדפדפן/מכשיר. `endpoint` + מפתחות-הצפנה, `user_agent`. קשור ל-owners.
- **push_log** / **reminder_log** — בקרת-קצב לתזכורות (פעם ביום / חידוש-חוזה / "אין-חוזה"). service-role בלבד (edge function), אין גישת-לקוח.
- **feedback** — הצעות-שיפור מהמשתמשים. `note`, `email`, `path`. משתמש רואה את שלו; מנהל (`dev@test.local`) רואה הכול.

**טיפוסי enum מרכזיים:** direction (income/expense), execution_type (automatic/requires_approval), task_status (open/done), task_source (manual/recurring_item/renewal), utility_payer (tenant/owner), document_type (9 ערכים), track_type (prime/fixed_unlinked/fixed_linked/variable), loan repayment_type (monthly_fixed/balloon).

## מודל-בעלות / ריבוי-משתמשים (קריטי)
- **לכל טבלאות-הנתונים יש `owner_id`** המצביע ל-owners.
- **RLS (Row-Level Security) מופעל**, עם מדיניות אחידה `owner_scoped`: `owner_id = auth.uid()`. כלומר **כל משתמש מזוהה רואה וכותב רק את השורות שלו** — בידוד מלא.
- **הסכימה כבר תומכת בכמה משתמשים נפרדים.** אין מודל "משק-בית משותף" — כל משתמש מנהל את הנתונים שלו, מבודד. כשבן-משפחה יתחבר (חשבון Google משלו), הנתונים שלו מבודדים אוטומטית **בלי שינוי-קוד**.
- מדיניות גישה אנונימית (anon) **הוסרה** (מיגרציה 026) — המפתח הציבורי לא ניגש לשום נתון.
- חריגים: `contract_utilities` מגודר דרך החוזה (בלי owner_id); `push_log`/`reminder_log` = service-role בלבד; `feedback` = שורות-המשתמש + עקיפת-מנהל.
- **אחסון הקבצים** מבודד אף הוא לפי תיקיית מזהה-המשתמש.
- *מגבלה:* האפליקציה מניחה **נכס אחד למשתמש** (האונבורדינג יוצר אחד; הבית מציג ראשי). ריבוי-נכסים-למשתמש לא נתמך במלואו.
