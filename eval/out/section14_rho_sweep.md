# §14 sensitivity — AUC as a function of rho (eval/run_section14.py)

Population: **research**, scorable (§15), N = 9,495, 449 defaults. Data source: synthetic. Protocol: single stratified 5-fold, pooled out-of-fold, one row per business (entity-disjoint). Features: all 71 engine features (including the Zakat-only 27–31, so this is a sensitivity measurement, NOT the credit lens's number) + sector/size/age dummies. Labels identical at every rho: True.

|   rho |   XGB OOF |   logit OOF |   XGB->serving |   XGB in-sample |   oracle (latent) |
|------:|----------:|------------:|---------------:|----------------:|------------------:|
|   0.6 |    0.5568 |      0.5959 |         0.5687 |          0.9918 |            0.666  |
|   0.7 |    0.5893 |      0.6059 |         0.5479 |          0.9882 |            0.666  |
|   0.8 |    0.575  |      0.5983 |         0.5391 |          0.9838 |            0.6659 |
|   0.9 |    0.5832 |      0.605  |         0.5776 |          0.9865 |            0.6659 |

Peak out-of-sample AUC = 0.6059; §14 circularity threshold 0.85 not reached.

## Signal ladder per rho

### rho = 0.6

| stage                                   |    AUC | note              |
|:----------------------------------------|-------:|:------------------|
| 1. latent risk index r (oracle ceiling) | 0.666  | -                 |
| 2. optimal combination of 9 u_obs draws | 0.6459 | rho_eff=0.914     |
| 3. single u_obs draw (median of the 9)  | 0.5923 | range 0.576-0.615 |
| 4. measured: logistic OOF on features   | 0.5959 | 82 features       |
| 5. measured: XGBoost OOF on features    | 0.5568 | untuned, overfits |

### rho = 0.7

| stage                                   |    AUC | note              |
|:----------------------------------------|-------:|:------------------|
| 1. latent risk index r (oracle ceiling) | 0.666  | -                 |
| 2. optimal combination of 9 u_obs draws | 0.6525 | rho_eff=0.947     |
| 3. single u_obs draw (median of the 9)  | 0.6107 | range 0.596-0.629 |
| 4. measured: logistic OOF on features   | 0.6059 | 82 features       |
| 5. measured: XGBoost OOF on features    | 0.5893 | untuned, overfits |

### rho = 0.8

| stage                                   |    AUC | note              |
|:----------------------------------------|-------:|:------------------|
| 1. latent risk index r (oracle ceiling) | 0.6659 | -                 |
| 2. optimal combination of 9 u_obs draws | 0.6575 | rho_eff=0.970     |
| 3. single u_obs draw (median of the 9)  | 0.6289 | range 0.616-0.643 |
| 4. measured: logistic OOF on features   | 0.5983 | 82 features       |
| 5. measured: XGBoost OOF on features    | 0.575  | untuned, overfits |

### rho = 0.9

| stage                                   |    AUC | note              |
|:----------------------------------------|-------:|:------------------|
| 1. latent risk index r (oracle ceiling) | 0.6659 | -                 |
| 2. optimal combination of 9 u_obs draws | 0.6614 | rho_eff=0.987     |
| 3. single u_obs draw (median of the 9)  | 0.6467 | range 0.638-0.656 |
| 4. measured: logistic OOF on features   | 0.605  | 82 features       |
| 5. measured: XGBoost OOF on features    | 0.5832 | untuned, overfits |

## Model baseline at the config rho (same protocol and features as the sweep)

```
======================================================================================
Model baseline at rho = 0.6 — entity-level 5-fold OOF, research population
======================================================================================
N = 9,495 businesses, 449 defaults (4.73%), 82 features

  oracle: latent risk index (ceiling)              AUC=0.6660                    
  logistic regression (L2, C=0.1)                  AUC=0.5940  89.2% of ceiling  
  logistic regression (L2, C=1.0)                  AUC=0.5959  89.5% of ceiling  
  XGBoost, untuned (as used by sweep_rho)          AUC=0.5568  83.6% of ceiling  400 trees, no early stop
  XGBoost, early-stopped (depth=2 mcw=20 L2=5.0)   AUC=0.5763  86.5% of ceiling  mean best_iter=37
  XGBoost, early-stopped (depth=3 mcw=20 L2=5.0)   AUC=0.5865  88.1% of ceiling  mean best_iter=31
  XGBoost, early-stopped (depth=3 mcw=50 L2=10.0)  AUC=0.5613  84.3% of ceiling  mean best_iter=33
  XGBoost, early-stopped (depth=4 mcw=50 L2=10.0)  AUC=0.5613  84.3% of ceiling  mean best_iter=33

  best logistic = 0.5959 | best early-stopped XGB = 0.5865 | delta = -0.0094
  => PARITY (or worse). At this event rate and feature count, gradient boosting
     buys nothing over logistic regression. That is a measurement about what the
     feature set supports, not a tuning failure — record it, do not chase it.
  Grid spread across early-stopped configs: 0.5613 - 0.5865
  (max over a grid scored on the same folds is mildly optimistic — spread shown so that is visible)
```

