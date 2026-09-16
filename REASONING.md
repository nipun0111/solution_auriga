# Reasoning

## Why This Exists
Splitting a ₹6,000 office gift on UPI always turns messy. Someone pays ₹500, someone pays ₹1,500 to cover a teammate, and two people forget completely. The organiser ends up stuck answering the same two questions on repeat: *"Have we collected enough?"* and *"How much do I owe?"*

This tool takes the raw inputs, does the math, and gives the organiser a clean list of who needs to send money to whom.

---

## Tech Stack: Zero Overhead
* **HTML5 + Vanilla JavaScript + Tailwind CSS (via CDN)**

I avoided frameworks like React or build tools intentionally. A casual gift pool shouldn't need `npm install` or a 200MB `node_modules` folder. You can download `index.html`, double-click it in any browser, and it runs immediately.

---

## How It Works

### 1. The Greedy Settlement Algorithm
Instead of creating a web of confusing individual IOUs:
1. Divide the ₹6,000 target by the number of people to get the **fair share**.
2. Find each person's net balance: `Paid - Fair Share`.
3. Sort people into who owes money (debtors) and who is owed money (creditors).
4. Match the largest debtor with the largest creditor. 

This settles the entire pool with the minimum possible number of UPI transfers.

### 2. Cleaning the Messy Input
People copy-paste chaotic transaction notes. The import script cleans it up before running the math:
* **Sanitizes text:** Cleans up messy names (`"  aLiCe "` → `"Alice"`) and strips symbols from amounts (`"₹500.00"` or `"500 INR"` → `500`).
* **De-duplicates:** Drops accidental double entries if someone clicks submit twice.
* **Merges:** Combines split payments (if Rahul sends ₹400 in the morning and ₹600 in the evening, he’s credited for ₹1,000).
* **Filters garbage:** Flags and skips empty names or unreadable amounts (like `"paid cash"`).