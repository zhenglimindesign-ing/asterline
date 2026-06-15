# Vela Pay — Synthetic Feedback Dataset (v1)
# 25 items · schema: feedback_id / timestamp / channel / contact_email / account_id / raw_text
#
# Design notes:
# - 8 items map to known context doc clauses (SP-x / KI-x / RM-x); 17 are novel issues
# - contact_email and account_id are optional (absent for app reviews / anonymous submissions)
# - PII embedded in raw_text where realistic (email, phone) — regex-redactable
#   Human names present but NOT regex-redactable — intentional known limitation of v1
# - FB-20: timestamp missing — edge case for ingest validation testing
# - All timestamps UTC+0
# - Synthetic data only

---

## FB-01
- timestamp: 2026-05-15T09:14:00Z
- channel: support ticket
- contact_email: ops@acmelogistics.com
- account_id: ACC-1042 (Acme Logistics)
- source_match: KI-1
- raw_text: |
  Ticket #58213 | Priority: High | Subject: Batch upload silently failing

  We uploaded our payroll CSV (620 rows) this morning at around 9am and nothing happened —
  no error, no confirmation, page just sat there for 10+ minutes. We ended up splitting it
  into two files manually to get it through, which took our ops team almost an hour during
  a busy week.

  This is the SECOND time this has happened to us (first time was back in March, support
  said it was a "known limitation" but we never got a clear number).

  — Dana Reyes, Ops Manager, Acme Logistics
  dana.reyes@acmelogistics.com | +1 (415) 555-0142

---

## FB-02
- timestamp: 2026-05-17T11:32:00Z
- channel: support ticket
- contact_email: treasury@vantagetrading.com
- account_id: ACC-9921 (Vantage Trading)
- source_match: — (novel issue)
- raw_text: |
  Ticket #58301 | Priority: Medium | Subject: Dashboard amount doesn't match actual debit

  The dashboard showed our payout as $5,000.00 before confirmation, but our bank statement
  shows we were debited $5,012.40. The extra $12.40 isn't itemized anywhere — is this an
  FX adjustment? If so it should be shown before we confirm, not discovered afterward.

  Reuben Castillo
  treasury@vantagetrading.com

---

## FB-03
- timestamp: 2026-05-18T14:05:00Z
- channel: feature request form
- contact_email: dev@brightlinemedia.io
- account_id: ACC-3387 (Brightline Media)
- source_match: — (novel issue)
- raw_text: |
  Feature request: webhook/API notifications for payout status

  We'd like to receive a webhook (or API polling endpoint) when a payout moves between
  statuses (pending/sent/completed/failed), so we can update our internal systems
  automatically instead of checking the dashboard manually.

---

## FB-04
- timestamp: 2026-05-20T08:47:00Z
- channel: app review
- contact_email: (none)
- account_id: (none)
- source_match: — (novel issue)
- raw_text: |
  ★★☆☆☆ "Logs me out constantly"

  The mobile app logs me out every couple of days and I have to go through the full
  login + 2FA flow again. Annoying when I just want to quickly check a balance.

---

## FB-05
- timestamp: 2026-05-22T10:18:00Z
- channel: support ticket
- contact_email: ap@meridianconsulting.com
- account_id: ACC-2210 (Meridian Consulting)
- source_match: KI-4 / SP-3
- raw_text: |
  Ticket #58502 | Priority: Urgent | Subject: Payout still not received after 6 days

  We sent a payout to one of our contractors 6 days ago and they still haven't received
  the funds. Your policy page says 1-3 business days for off-ramp. This is a payroll
  payment and the contractor (based in [Country A]) is messaging us asking what's going
  on — it's getting awkward on our end.

  Can someone please look into this today? Transaction ref: VP-994821.

  Tom Adeyemi
  Accounts Payable, Meridian Consulting
  tom.adeyemi@meridianconsulting.com

---

## FB-06
- timestamp: 2026-05-24T16:30:00Z
- channel: support ticket
- contact_email: ops@fieldworkagency.com
- account_id: ACC-7102 (Fieldwork Agency)
- source_match: — (novel issue)
- raw_text: |
  Ticket #58620 | Priority: High | Subject: Recipient name mismatch on confirmation vs bank record

  The confirmation screen showed the recipient name as "J. Okafor" but the actual transfer
  that landed in their bank shows a different spelling ("J. Okefor"), which caused their
  bank to flag it for review and delay the deposit by 2 days. Where does the confirmation
  screen pull the name from?

  Chidi Osei
  ops@fieldworkagency.com

---

## FB-07
- timestamp: 2026-05-26T09:00:00Z
- channel: feature request form
- contact_email: (none)
- account_id: (none)
- source_match: RM-2
- raw_text: |
  Feature request: Recurring/scheduled payouts

  It would save us so much time if we could set up recurring payouts — right now we have
  to re-upload the same CSV every single month for payroll. A "repeat monthly" option,
  even just for a fixed list of recipients/amounts, would be huge for small teams like ours.

---

## FB-08
- timestamp: 2026-05-27T13:22:00Z
- channel: support ticket
- contact_email: cfo@northwindops.com
- account_id: ACC-5519 (Northwind Operations)
- source_match: RM-3
- raw_text: |
  Ticket #58701 | Priority: Low | Subject: Approval workflow for large payouts

  We have a finance director who needs to approve any payout over $5,000 before it goes
  out, but right now any admin can just send it immediately. As we add more team members
  this is becoming a real risk for us. Can you add an approval step for payouts above a
  configurable threshold?

  — Submitted via dashboard contact form

---

## FB-09
- timestamp: 2026-05-26T15:44:00Z
- channel: feature request form
- contact_email: ap@northwindops.com
- account_id: ACC-5519 (Northwind Operations)
- source_match: — (novel issue)
- raw_text: |
  Feature request: memo/reference field on payouts

  We'd like to attach an internal reference number or memo to each payout (e.g. our own
  invoice number) so it's easier to match against our accounting system later — right now
  there's no way to tag a payout with anything beyond the recipient.

---

## FB-10
- timestamp: 2026-05-29T10:05:00Z
- channel: support ticket
- contact_email: treasury@delsolexports.mx
- account_id: ACC-6034 (Del Sol Exports)
- source_match: — (novel issue)
- raw_text: |
  Ticket #58740 | Priority: Low | Subject: Support replied in English to a Spanish-language ticket

  I submitted my ticket in Spanish and got a reply entirely in English. Not a huge deal
  since I read English fine, but my colleague who handles most of our tickets doesn't,
  and this has happened twice now.

  Lucia Fernandez
  treasury@delsolexports.mx

---

## FB-11
- timestamp: 2026-05-30T09:17:00Z
- channel: support ticket
- contact_email: finance@harborgoods.com
- account_id: ACC-1187 (Harbor Goods)
- source_match: — (novel issue)
- raw_text: |
  Ticket #58812 | Priority: Medium | Subject: Card transaction shows wrong currency in dashboard

  One of our team's card purchases was made in EUR, but the dashboard transaction list
  shows it labeled as USD with the EUR amount as the number (no conversion applied in
  the display) — makes the running total look wrong at a glance, even though the actual
  charge to our balance seems correct.

---

## FB-12
- timestamp: 2026-06-01T11:45:00Z
- channel: support ticket
- contact_email: c.osei@fieldworkagency.com
- account_id: ACC-7102 (Fieldwork Agency)
- source_match: SP-4
- raw_text: |
  Ticket #59014 | Priority: Medium | Subject: Dispute still "under review" after 12 days

  I submitted a dispute for a card charge 12 days ago and haven't heard anything back.
  Dashboard still shows "under review". Your policy says disputes are reviewed within
  5 business days — it's now been more than double that. Can someone check on this?
  [Screenshot of dispute status attached]

  Chidi Osei
  c.osei@fieldworkagency.com

---

## FB-13
- timestamp: 2026-06-01T14:22:00Z
- channel: support ticket
- contact_email: tom.adeyemi@meridianconsulting.com
- account_id: ACC-2210 (Meridian Consulting)
- source_match: — (novel issue)
- raw_text: |
  Ticket #59005 | Priority: Low | Subject: Export limited to 90 days

  When exporting transaction history, it looks like we can only go back 90 days at a time.
  For our year-end accounting we need a full 12-month export — currently we'd have to do
  this in 4-5 separate exports and stitch them together.

---

## FB-14
- timestamp: 2026-06-02T08:55:00Z
- channel: email
- contact_email: finance@littlebay.co
- account_id: ACC-8847 (Little Bay Goods)
- source_match: SP-6
- raw_text: |
  From: finance@littlebay.co
  To: support@velapay.com
  Subject: Surprised by KYB requirement

  Hi, we're a small business and just crossed $1,000 in total payout volume — suddenly
  we're being asked to complete a full KYB process with documents we don't have ready
  (registration certs, etc.). It would've been really helpful to get a heads-up before
  we hit that limit so we could prepare. As it stands, our payouts are now on hold while
  we scramble.

  Thanks,
  Amira Hassan
  finance@littlebay.co

---

## FB-15
- timestamp: 2026-06-02T10:12:00Z
- channel: email
- contact_email: finance@littlebay.co
- account_id: ACC-8847 (Little Bay Goods)
- source_match: — (novel issue)
- raw_text: |
  From: finance@littlebay.co
  To: support@velapay.com
  Subject: Never received onboarding email

  Hi, we signed up about a week ago but never got any onboarding/welcome email — we only
  found out our account was active because someone tried logging in. Is this a known
  delivery issue? We almost gave up thinking the signup hadn't gone through.

  Thanks,
  Amira Hassan

---

## FB-16
- timestamp: 2026-06-03T07:48:00Z
- channel: support ticket
- contact_email: admin@northwindops.com
- account_id: ACC-5519 (Northwind Operations)
- source_match: SP-10
- raw_text: |
  Ticket #59140 | Priority: URGENT | Subject: Locked out of admin account — payroll due tomorrow

  I'm locked out of our company's primary admin account — lost my phone with the 2FA app
  on it last night. We have payroll due tomorrow morning and I can't access the account
  at all to send the batch. What do I need to do to get back in ASAP?
  Please call me if faster: +44 7700 900123.

  Sam Whitfield
  admin@northwindops.com

---

## FB-17
- timestamp: 2026-06-03T19:34:00Z
- channel: app review
- contact_email: (none)
- account_id: (none)
- source_match: — (novel praise)
- raw_text: |
  ★★★★★ "Clean, no-nonsense dashboard"

  Really appreciate how uncluttered the dashboard is compared to other fintech tools I've
  used — everything I need is visible without digging through menus. Whoever designed
  this, thank you.

---

## FB-18
- timestamp: 2026-06-04T09:00:00Z
- channel: survey response
- contact_email: ops@harborgoods.com
- account_id: ACC-1187 (Harbor Goods)
- source_match: — (novel praise)
- raw_text: |
  Q: Describe a recent support interaction.
  A: Had a quick question about card limits, got a clear answer within an hour via chat.
  No back-and-forth needed. Pretty smooth.

---

## FB-19
- timestamp: 2026-06-04T11:15:00Z
- channel: survey response
- contact_email: ops@vantagetrading.com
- account_id: ACC-9921 (Vantage Trading)
- source_match: — (novel praise)
- raw_text: |
  Q: Anything that exceeded expectations during setup?
  A: Honestly the KYB approval was much faster than we expected — submitted Tuesday,
  approved by Wednesday afternoon. Other providers took us almost two weeks.

---

## FB-20
- timestamp: (missing — ingest validation edge case)
- channel: support ticket
- contact_email: (none)
- account_id: (none)
- source_match: — (noise)
- raw_text: |
  Ticket #59401 | Priority: Low | Subject: (no subject)

  does this support apple pay? just curious, not urgent

---

## FB-21
- timestamp: 2026-06-06T14:03:00Z
- channel: app review
- contact_email: (none)
- account_id: (none)
- source_match: — (noise / too vague)
- raw_text: |
  ★★☆☆☆ "meh"

  App is just kind of clunky honestly, not sure what else to say. Could be better.

---

## FB-22
- timestamp: 2026-06-08T08:59:00Z
- channel: support ticket
- contact_email: ops@acmelogistics.com
- account_id: ACC-1042 (Acme Logistics)
- source_match: — (novel issue, same account as FB-01)
- raw_text: |
  Ticket #59288 | Priority: High | Subject: 2FA codes not arriving via SMS

  Two of our team members (both on the same mobile carrier) stopped receiving 2FA codes
  via SMS this week — codes for everyone else arrive fine. They're currently unable to
  log in. Is this a known carrier-specific issue?

  Dana Reyes
  ops@acmelogistics.com

---

## FB-23
- timestamp: 2026-06-09T13:44:00Z
- channel: support ticket
- contact_email: treasury@delsolexports.mx
- account_id: ACC-6034 (Del Sol Exports)
- source_match: SP-8
- raw_text: |
  Ticket #59340 | Priority: Medium | Subject: Spread changed after confirmation?

  I confirmed a currency conversion at one rate (screenshot of confirmation attached),
  but when I checked the transaction details afterward, the spread shown was different
  from what I confirmed — about 0.3% higher. It's not a huge amount in absolute terms,
  but it shouldn't change after I've already confirmed it, right? Can someone check this
  specific transaction (ref VP-100442)?

  Lucia Fernandez
  treasury@delsolexports.mx

---

## FB-24
- timestamp: 2026-06-10T10:30:00Z
- channel: feature request form
- contact_email: (none)
- account_id: (none)
- source_match: — (novel issue)
- raw_text: |
  Feature request: dark mode

  Would love a dark mode for the dashboard — easier on the eyes for late-night
  reconciliation sessions.

---

## FB-25
- timestamp: 2026-06-12T16:22:00Z
- channel: app review
- contact_email: (none)
- account_id: (none)
- source_match: — (novel praise)
- raw_text: |
  ★★★★★ "Smooth onboarding"

  Setup took maybe 15 minutes start to finish, including KYB. Way less painful than
  I expected based on horror stories from other fintech signups.
