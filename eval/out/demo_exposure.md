# What the serving population shows in a demo (DECISIONS entries 29, 43, 47)

Data source: synthetic. Serving population, 1,000 businesses; 943 scored or partial_profile, 57 `insufficient_data`. Every object comes from `pipeline.week8.decision_object` over the serving store, the code path the API and the Week 8 CLI use. Counts only: nothing is fitted or chosen here.

## 1. The first sentence of the customer explanation

**Feature 3 (`inflow_regularity_score`) is the first public reason for 834 of 943 businesses**, and feature 3 or its z-score 55 is among the three public reasons for 943 of 943.

| sector | businesses | feature 3 is the first reason | of those: counted against | of those: counted in favour |
|---|---|---|---|---|
| construction | 360 | 298 | 0 | 298 |
| food_beverage | 148 | 138 | 138 | 0 |
| professional_services | 26 | 25 | 0 | 25 |
| retail_trade | 409 | 373 | 373 | 0 |

Read with entry 43: within a sector the direction does not vary, so the sentence describes the business's sector, not the business.

## 2. Why businesses are declined

**281 of 943 are declined; 243 of those 281 by the §31 affordability gate** and 38 by the risk model.

| decline reason | businesses |
|---|---|
| `affordability_no_installment_capacity` | 223 |
| `risk_model` | 38 |
| `affordability_below_minimum_amount` | 20 |

## 3. How many anomaly flags a business gets

**584 of 943 businesses return the cap of 10 flags; the fewest any business returns is 4.** No business comes back with none, so a flag is a place in a review queue, not an alarm.

| flags returned | businesses |
|---|---|
| 4 | 2 |
| 5 | 26 |
| 6 | 69 |
| 7 | 80 |
| 8 | 88 |
| 9 | 94 |
| 10 | 584 |
