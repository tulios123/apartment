# הכנה-בלבד (🔴 דורש-בעלים): SW-12 ביטול-שליפות ו-SW-06 פיצול-קוד

> הוכן בריצת-הביקורת 18.07.2026. שני אלה שינויי-התנהגות בזמן-ריצה — לא בוצעו, רק תוכננו.

## SW-12 — ביטול-שליפות ב-hooks (סיכון: מרוץ-מצבים / setState אחרי unmount)

**המצב:** כל ה-hooks (`usePropertyData`, `useMortgageData`, `useInvestmentData`, `useTransactions`, `useDashboardStats`, `useInsurance`, `useTasks`, `useRecurringItems`, `useDocuments`) שולפים ב-`useEffect` בלי `AbortController` ובלי דגל-ביטול. ניווט מהיר בין מסכים משאיר שליפות רצות; תשובה מאוחרת יכולה לדרוס מצב חדש או להיזרק על רכיב שהוסר (האזהרה נעלמה ב-React 18, המרוץ נשאר).

**התוכנית המוצעת (גל אחד, ~9 קבצים, דפוס זהה):**
1. בכל hook, בתוך ה-effect: `let cancelled = false; ... return () => { cancelled = true }`.
2. אחרי כל `await`, לפני כל `setState`: `if (cancelled) return`.
3. לא להוסיף `AbortController` בשלב זה (supabase-js תומך `abortSignal` אבל זה משנה גם את צורת-השגיאות — שלב שני נפרד אם בכלל).
4. בדיקות: לכל hook בדיקת "תשובה מאוחרת אחרי ביטול לא נכתבת" (mock fetch דחוי).

**למה לא בוצע עכשיו:** נגיעה בכל שכבת-הנתונים בבת-אחת; שווה בדיקה חיה ממוקדת אחרי כל hook — לא מתאים ללילה אוטונומי לפי גבול-האוטונומיה.

## SW-06 — פיצול-קוד (צ׳אנק יחיד ~1.05MB)

**המצב:** כל האפליקציה נבנית לצ׳אנק JS יחיד (1,055KB / ~292KB gzip). טעינה ראשונה בטלפון איטית מהנדרש.

**התוכנית המוצעת:**
1. `React.lazy` + `Suspense` על רמת-הראוטים ב-`App.tsx`: `FeedbackAdmin` (מנהל בלבד — אף בן-משפחה לא צריך אותו), `Onboarding` (רץ פעם אחת), עמודי-legal, `ScanReview/ScanDocList`.
2. fallback: ה-`Splash`/`Skeleton` הקיימים — אין רכיב חדש.
3. לוודא שה-PWA precache (workbox) קולט את הצ׳אנקים החדשים אוטומטית.
4. מדידה לפני/אחרי ב-`npm run build` (יעד: צ׳אנק ראשי < 700KB).

**למה לא בוצע עכשיו:** משנה סדר-טעינה בזמן-ריצה (Suspense flashes, אינטראקציה עם ה-service worker וה-update banner) — דורש בדיקת-עשן על מכשיר אמיתי אחרי פריסה, עדיף עם הבעלים ער.
