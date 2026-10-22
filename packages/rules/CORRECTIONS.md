# Changes from Entrust's specification

`src/steps.ts` encodes the 125 canonical steps from **CLEAR Export Technical Alignment & Production
Build Specification** (Entrust Africa, October 2026). This file lists every place where the data
differs from that document, and why, so Entrust can review and sign off.

Other inputs: the **Operational Control Matrix** (OCM), the short **Production Build Alignment &
Executive Resolution Standard** (CLEAR-PAS-2026-V1), the **Six-SME Export Journey Reconstruction
Register** (21 October 2026), and the source research done for the CLEAR simulation (10 October 2026).

Step ids are unchanged, so every step can still be traced to the spec. A changed step keeps the
spec's wording in `specName` or `specClass` and lists the correction ids below in `corrections`.

## Corrections

### C-01 Banks issue and discharge export permits, not NBE

Steps 046, 048, 119 and 121 named the National Bank of Ethiopia as the body that issues,
reconciles and discharges the export permit. Under NBE Directive FXD/01/2024, Art. 7.1.1,
authorized commercial banks issue export permits. Entrust's own answer to Q6 says the same: "Banks
issue export permits via eSW".

| Step | Spec name | Now |
| --- | --- | --- |
| STEP-046 | NBE Foreign Exchange Export Permit Application (eSW) | Bank Export Permit Application (eSW) |
| STEP-048 | NBE Export Permit Registration & Approval Confirmation | Bank Export Permit Issued & Recorded |
| STEP-119 | National Bank of Ethiopia (NBE) FX Permit Repatriation Reconciliation | Export Permit Repatriation Reconciliation |
| STEP-121 | NBE Export Permit Discharge Certificate Issuance | Export Permit Discharge by the Authorized Bank |

The owner of 048, 119 and 121 is the bank. MC-07 is renamed from "Banking, Forex & NBE Permits" to
"Banking, Forex & Export Permits" for the same reason.

STEP-120 keeps "NBE" in its name: the 90-day rule is NBE's, even though the bank runs the clock.

**To confirm:** we did not find a source describing the discharge step itself (STEP-121). We assume
the bank that issued the permit discharges it once proceeds are reconciled.

### C-02 Exporters do not receive an FX allocation

STEP-047 was "Commercial Bank FX Allocation & Approval". Banks allocate foreign exchange to
importers; an exporter brings foreign exchange in. We renamed the step to "Commercial Bank Review of
the Export Permit Application", which is what happens between the application (046) and the permit
(048).

**To confirm:** if Entrust meant something else by "FX allocation" (for example the retention split
under FXD/01/2024 Art. 6.2), tell us and we will add it as its own step.

### C-03 The minimum export price is ECTA's, and only for coffee

STEP-024 was "NBE Minimum Export Price Floor Benchmark Cross-Check". Entrust's answer to Q5 says
ECTA sets coffee minimum export prices weekly. We found no official floor for the other launch
products. The step is now "Minimum Export Price Cross-Check (ECTA Weekly Price for Coffee)". For
other products it follows Q5: check against a verified benchmark, or mark it not applicable with
a reason.

The step stays under MC-07, as the short specification says (STEP-024 / MC-07).

### C-04 Coffee contracts are registered with ECTA

STEP-034 was "NBE Trade Contract Registration Preparation". Proclamation 1051/2017 Art. 10(4)
originally required registration at NBE. USDA FAS reports that registration moved to ECTA on 1 May
2025, and Entrust's answer to Q5 says "mandatory ECTA contract registration". The step is now
"Sales Contract Registration Preparation (ECTA for Coffee)", with the authorized bank as the
registration point for other products.

**To confirm:** where contracts for spices, avocados and processed food are registered.

### C-05 The final bill of lading comes after loading

The spec lists STEP-094 (Carrier Final Bill of Lading Issuance) before STEP-104 (Vessel Loading &
Departure Confirmation). A carrier issues an on-board bill of lading only after the goods are
loaded, and banks require one (UCP 600 Art. 20(a)(ii)). In the data, STEP-104 now comes before
STEP-094 and is its prerequisite. The ids are unchanged; only the order in phase 6 differs.

Phase 6 order in the data: 092, 093, 095, 096, 097, 098, 100, 101, **104, 094**, 099, 102, 103,
105, 106, 107, 108.

### C-06 The ISF is filed before loading

The spec places STEP-097 (ISF 10+2) after the final bill of lading. Under 19 CFR 149.2 the ISF is
due no later than 24 hours before the cargo is loaded at the foreign port, as Entrust's answer to
Q12 also says. In the data, STEP-097 comes before STEP-104 and is one of its prerequisites. The ISF
needs the booking (STEP-074) and the HS code (STEP-010), so those are its prerequisites.

### C-07 Steps that only apply in some cases are conditional

The spec marks many steps "Mandatory" even though their names limit them to a destination,
transport mode or payment term ("for US-bound", "if Red Channel", "if CAD"). A mandatory step
applies to every case, so these would show up for cases they cannot apply to. They are now
conditional, with the condition taken from the step name:

| Step | Applies when |
| --- | --- |
| 026 LC Terms & Discrepancy Risk Audit (was Exception) | payment is by LC |
| 027 CAD Payment Agreement | payment is wholly or partly CAD |
| 028 Advance Payment Credit Advice | payment is wholly or partly advance TT |
| 038 US FDA Facility Registration | destination is the US |
| 039 US Agent Appointment | destination is the US |
| 040 Turkish Import Rule Check | destination is Turkey |
| 041 EU TRACES & Contaminant Limits | destination is in the EU |
| 056 ECX Auction Sourcing | the commodity is bought through ECX |
| 057 Direct Specialty Coffee Procurement | the product is coffee bought directly |
| 075 Container Equipment | the cargo goes by sea |
| 076 Reefer Set-Point | the cargo needs cold chain |
| 077 EIR & Truck Allocation | the cargo goes by sea |
| 079 Dry Port Intake | the cargo goes by sea |
| 083 Customs Physical Inspection | Customs assigned the Red Channel |
| 085 Container Stuffing Supervision | the cargo goes by sea |
| 086 Container Seal | the cargo goes by sea |
| 089 Djibouti Port Transit | the cargo goes by sea |
| 097 ISF 10+2 | destination is the US and the cargo goes by sea |
| 103 Courier for Original Documents | payment is wholly or partly CAD |
| 112 LC Presentation Deadline | payment is by LC |
| 113 SWIFT Transmission Advice (MT730 / MT400) | payment is by LC or CAD |
| 114 CAD Collecting Bank Handoff | payment is wholly or partly CAD |
| 115 Buyer Document Acceptance | payment is by LC or CAD |

The ISF (097) applies to ocean cargo only: 19 CFR 149 covers vessel cargo. The Reconstruction
Register (FP-08) also says the container check must never show for air or non-containerised
cargo.

A case can have more than one payment term. ZEBU Coffee's 10% advance with 90% CAD makes 027, 028,
103, 113, 114 and 115 apply, and 026 and 112 not apply.

### C-08 Phase ranges follow the detailed step list

The two specification documents give different phase ranges. The short document puts phase 3 at
STEP-036 to STEP-055 and phase 4 at STEP-056 to STEP-075, and so on. The detailed list (and the OCM)
uses:

| Phase | Steps | Milestone |
| --- | --- | --- |
| 1 Exporter Onboarding & Product Identity | 001 to 018 | Product Identity Locked |
| 2 Buyer Contracting & Commercial Terms | 019 to 035 | Commercial Readiness Locked |
| 3 Destination Admissibility & Regulatory Licensing | 036 to 054 | Regulatory & Market Pathway Approved |
| 4 Commodity Sourcing, Processing & Quality Control | 055 to 072 | Cargo Packed & Quality Certified |
| 5 Logistics, Container Equipment & Customs Clearance | 073 to 091 | Cargo Cleared & Released for Export |
| 6 Destination Pre-Arrival & Post-Shipment Logistics | 092 to 108 | Cargo Shipped & Delivered |
| 7 Banking Presentation, FX Repatriation & Case Closure | 109 to 125 | Payment Reconciled & Case Closed |

We used the detailed list, as the build issue asked. Its milestone steps (018, 035, 054, 072, 091,
108, 125) are the last step of each range, which the short document's ranges break.

The OCM also names seven milestone statuses (Case Intake, Commercial Ready, Compliance Verified,
Ready for Export, Shipment Released, Payment Reconciled, Case Closed) that do not line up with the
seven phases. We used the milestone names from the detailed list.

### C-09 Pilot checkpoints map to master controls by what they do

The spec maps the 84 pilot checkpoints to master controls by position: checkpoint S06 of each case
to MC-06, S07 to MC-07, and so on. The checkpoints in the Reconstruction Register are not in the
same order as the master controls, so that mapping is wrong for S06 to S12. Mapped by content:

| Checkpoint | What it covers | Spec | Now |
| --- | --- | --- | --- |
| S01 | Case intake & product identity | MC-01 | MC-01 |
| S02 | Buyer & commercial terms | MC-02 | MC-02 |
| S03 | Market admissibility | MC-03 | MC-03 |
| S04 | Exporter & regulatory readiness | MC-04 | MC-04 |
| S05 | Quality, testing & certification | MC-05 | MC-05 |
| S06 | Finance & foreign exchange | MC-06 | **MC-07** |
| S07 | Production / aggregation readiness | MC-07 | **MC-08** |
| S08 | Packaging, labeling & traceability | MC-08 | **MC-06** |
| S09 | Freight & route plan | MC-09 | MC-09 |
| S10 | Container / cargo availability | MC-10 | **MC-09** |
| S11 | Export declaration & document consistency | MC-11 | **MC-10** |
| S12 | Inspection / release / dispatch | MC-12 | **MC-10** |
| S13 | Transport documents & buyer/bank handoff | MC-13 | MC-12 and MC-13 |
| S14 | Arrival, delivery & closure | MC-14 | MC-14 |

No pilot checkpoint covers MC-11 (destination pre-arrival filings). It is still used by steps
095 to 098.

### C-10 Three classes swapped between exception and mandatory

- **STEP-099 Zero Discrepancy Audit: Exception → Mandatory.** The OCM makes MC-12 mandatory and
  says it blocks bank presentation. FL-06 also says the audit runs before every CAD/LC presentation.
  As an exception step it would only run after something had already gone wrong.
- **STEP-071 Quality Non-Conformance Handling: Mandatory → Exception.** It only applies after a lab
  test, grading or inspection fails (FL-05). As a mandatory step, every case would have to record a
  non-conformance.
- **STEP-026 LC Terms Audit: Exception → Conditional.** See C-07.

### C-11 Health certificates follow the destination check, like phytosanitary certificates

The spec makes phytosanitary inspection and issuance (049, 069) conditional, but health and free
sale certificates (051, 070) mandatory. Both depend on the same check, STEP-042 (Destination
Phytosanitary / Health Permit Requirement Check). A health certificate is not needed for every
product and destination. Green coffee to the US, for example, needs none. 051 and 070 are now
conditional on STEP-042 finding that a health certificate is required.

### C-12 Owners, prerequisites, evidence and master controls are a draft

The spec gives every one of the 125 steps the same owner ("SME Export Officer / CLEAR System") and
the same supporting authority ("Ethiopian Customs / NBE / MoA / ECTA"). It lists no prerequisites,
conditions, evidence or master controls per step, though CLEAR-PAS-2026-V1 item 2.1 says each step
defines them. These fields in `src/steps.ts` are AfriConnect's draft, and Entrust needs to review
them:

- **Owner**: who has to act for the step to move: SME, Entrust (verification and sign-off), CLEAR
  (automated), buyer, bank or authority. This drives the "Awaiting …" task statuses.
- **Prerequisites**: what has to be complete first. They follow real dependencies, not phase order.
  For example, bank presentation for CAD (109, 110) waits on the document set (102), not on proof
  of delivery (107). Under CAD the buyer pays before they can collect the cargo, so presentation
  cannot wait for delivery.
- **Evidence**: the documents each step needs approved. Physical certificates, bank permits and
  customs release notes always need a human reviewer (Entrust's answer to Q9).
- **Deadlines**: only where a source gives one: the permit's 30-day validity for the customs
  declaration (FXD/01/2024 Art. 7.1.6), the 90-day repatriation clock (FXD/01/2024 Annex One
  1.3.2), the ISF's 24 hours before loading (19 CFR 149.2), Prior Notice before arrival
  (21 CFR 1.279), and LC presentation within 21 days of shipment (UCP 600 Art. 14(c)).

## Questions for Entrust (not changed)

These look inconsistent, but we left them as the spec has them until Entrust decides.

1. **Commercial invoice and packing list come after the customs declaration.** STEP-100 and
   STEP-101 finalise them in phase 6, but the customs declaration (STEP-080, phase 5) needs both.
   The OCM's gate rule also requires a "Verified Invoice/Packing List" before the eSW declaration.
   Should 100 and 101 move before 080, or should phase 5 have its own draft invoice and packing
   list steps?
2. **Bank presentation with advance payment.** STEP-109 and STEP-110 are mandatory. With 100%
   advance TT there is no document presentation for payment. Do documents still go to the bank,
   for example to close the permit?
3. **STEP-098 and STEP-111 as exceptions.** We kept them as exceptions, raised only when a
   pre-arrival filing fails (098) or the bank finds discrepancies (111). Is that what Entrust
   intends, or should either run on every case?
4. **No destination check for the GCC.** The US, Turkey and the EU each have a destination step
   (038 to 041). The avocado corridor goes to the GCC, which has none.
5. **Insurance under CIF.** No step or evidence covers the insurance certificate a CIF seller must
   provide.
6. **Courier for originals under LC.** STEP-103 is "if CAD". Under an LC, original documents are
   also couriered between banks. Should 103 also apply to LC?
7. **Failure rules FL-09 to FL-14.** The spec says there are 14 failure rules, but only FL-01 to
   FL-08 have been provided. The exception steps cite the FL-01 to FL-08 rules that raise them.
   The other six may raise more.
8. **Air freight wording.** Steps written for sea freight keep their names for air shipments, for
   example STEP-104 "Vessel Loading" (for air, aircraft departure) and STEP-092 "B/L / AWB".
