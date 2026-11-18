"""Builds the panel's datasets from the IEA Global Hydrogen Review 2026 (CC BY 4.0).

Bar values were read from the report's vector charts with scripts/extract_chart.py
(page number in each dataset); single figures come from the report text.
Usage: python build_data.py <output dir>"""
import json, sys, os
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
r2 = lambda x: round(x, 2)
def save(name, rows):
    json.dump(rows, open(os.path.join(out, name + '.json'), 'w'), ensure_ascii=False, indent=1)

# Figure 2.1, p. 45: hydrogen demand by sector (Mt H2)
dem = {2020: (51.554, 38.6, 0.175), 2021: (52.867, 40.35, 0.35), 2022: (52.955, 41.751, 0.438), 2023: (54.005, 42.976, 0.7),
       2024: (55.405, 43.589, 0.788), 2025: (57.244, 44.114, 0.963), 2030: (63.283, 45.515, 4.201)}
save('demand_by_sector', [{'year': y, 'estimate': y == 2030, 'industry_mt': r2(a), 'refining_mt': r2(b), 'new_uses_mt': r2(c), 'total_mt': r2(a + b + c)} for y, (a, b, c) in dem.items()])

# Figure 3.1, p. 83: production by route (Mt H2) and by region in 2025
prod = {2021: (59.03, 18.9, 0.399, 0.599, 14.574, 0.067), 2022: (60.227, 19.033, 0.399, 0.599, 14.841, 0.067), 2023: (61.625, 19.699, 0.333, 0.599, 15.373, 0.067),
        2024: (62.357, 20.83, 0.333, 0.599, 15.506, 0.133), 2025: (62.889, 22.494, 0.266, 0.665, 15.772, 0.2)}
save('production_by_route', [{'year': y, 'natural_gas_mt': r2(a), 'coal_mt': r2(b), 'oil_mt': r2(c), 'fossil_ccus_mt': r2(d), 'by_product_mt': r2(e), 'electrolysis_mt': r2(f),
                              'total_mt': r2(a + b + c + d + e + f)} for y, (a, b, c, d, e, f) in prod.items()])
reg = {'China': 31.145, 'North America': 16.637, 'Middle East': 14.042, 'India': 9.783, 'Europe': 7.454, 'Rest of world': 23.226}
tot = sum(reg.values())
save('production_by_region_2025', [{'region': k, 'mt': r2(v), 'share_pct': round(100 * v / tot, 1)} for k, v in reg.items()])

# Figure 3.2, p. 84: low-emissions hydrogen production (Mt H2) by route and region
regs = ['United States', 'Canada', 'Europe', 'China', 'Middle East', 'Rest of world']
ccus = {2021: (0.325, 0.176, 0, 0.006, 0.071, 0), 2022: (0.325, 0.176, 0, 0.027, 0.071, 0), 2023: (0.325, 0.176, 0, 0.05, 0.071, 0),
        2024: (0.325, 0.176, 0.001, 0.056, 0.071, 0), 2025: (0.399, 0.176, 0.001, 0.058, 0.071, 0.001), 2026: (0.501, 0.176, 0.012, 0.058, 0.071, 0.001)}
elec = {2021: (0.004, 0.002, 0.009, 0.007, 0.001, 0.012), 2022: (0.005, 0.002, 0.013, 0.012, 0.001, 0.014), 2023: (0.007, 0.002, 0.017, 0.026, 0.001, 0.016),
        2024: (0.008, 0.002, 0.026, 0.052, 0.001, 0.019), 2025: (0.017, 0.002, 0.041, 0.094, 0.001, 0.024), 2026: (0.034, 0.002, 0.079, 0.208, 0.003, 0.031)}
rows = []
for y in ccus:
    for i, rg in enumerate(regs):
        rows.append({'year': y, 'estimate': y == 2026, 'region': rg, 'fossil_ccus_mt': ccus[y][i], 'electrolysis_mt': elec[y][i]})
save('low_emissions_production', rows)

# Figure 3.8, p. 90: installed electrolyser capacity (GW)
tech = {2021: (0.352, 0.16, 0.046), 2022: (0.389, 0.233, 0.064), 2023: (0.824, 0.302, 0.224), 2024: (1.153, 0.444, 0.348), 2025: (2.507, 0.686, 0.961), 2026: (4.063, 1.281, 1.679)}
save('electrolyser_capacity', [{'year': y, 'estimate': y == 2026, 'alkaline_gw': a, 'pem_gw': b, 'other_gw': c, 'total_gw': r2(a + b + c)} for y, (a, b, c) in tech.items()])
save('electrolyser_capacity_by_region', [
    {'year': 2025, 'estimate': False, 'region': k, 'gw': v} for k, v in {'China': 2.667, 'Europe': 0.654, 'United States': 0.439, 'Rest of world': 0.393}.items()] + [
    {'year': 2026, 'estimate': True, 'region': k, 'gw': v} for k, v in {'China': 3.244, 'Europe': 2.654, 'United States': 0.54, 'Rest of world': 0.586}.items()])

# Figure 3.11, p. 95: electrolyser manufacturing capacity (GW/yr); "Idle" is capacity reported as idle
man = {2022: (7.084, 2.396, 2.24, 0.833, 0.99, 0), 2023: (21.148, 4.271, 3.75, 0.781, 1.094, 1.979), 2024: (28.753, 6.824, 3.802, 2.292, 2.031, 1.979),
       2025: (36.254, 7.397, 5.417, 2.552, 1.146, 5.261), 2026: (38.285, 7.813, 6.459, 3.854, 1.563, 6.303)}
rows = []
for y, v in man.items():
    for k, x in zip(['China', 'Europe', 'United States', 'India', 'Rest of world', 'Idle'], v):
        rows.append({'year': y, 'estimate': y == 2026, 'region': k, 'gw_per_year': x})
save('manufacturing_capacity', rows)
save('manufacturing_2030_announced', [
    {'edition': 'GHR 2025', 'committed_gw': 58.41, 'announced_gw': 63.47, 'idle_or_unspecified_gw': r2(63.987 + 3.115), 'total_gw': 188.97},
    {'edition': 'GHR 2026', 'committed_gw': 63.99, 'announced_gw': 24.92, 'idle_or_unspecified_gw': 6.23, 'total_gw': 95.13}])

# Figure 3.5, p. 87: low-emissions production by 2030 in announced projects (Mt H2)
el = {'Europe': 5.595, 'Latin America': 4.349, 'Australia': 2.521, 'China': 2.323, 'India': 2.068, 'United States': 1.204, 'Middle East': 1.048, 'Canada': 0.581, 'Rest of world': 1.671}
cc = {'Europe': 1.53, 'Latin America': 0, 'Australia': 0.411, 'China': 0.057, 'India': 0.014, 'United States': 3.669, 'Middle East': 0.269, 'Canada': 0.609, 'Rest of world': 0.014}
save('pipeline_2030_by_region', [{'region': k, 'electrolysis_mt': el[k], 'fossil_ccus_mt': cc[k], 'total_mt': r2(el[k] + cc[k])} for k in el])
save('pipeline_2030_by_status', [
    {'status': 'Operational', 'electrolysis_mt': 0.312, 'fossil_ccus_mt': 0.807},
    {'status': 'Final investment decision', 'electrolysis_mt': 2.125, 'fossil_ccus_mt': 1.162},
    {'status': 'Strong potential', 'electrolysis_mt': 1.133, 'fossil_ccus_mt': 0.652},
    {'status': 'Moderate potential', 'electrolysis_mt': 2.621, 'fossil_ccus_mt': 3.329},
    {'status': 'Low potential', 'electrolysis_mt': 2.153, 'fossil_ccus_mt': 0.623},
    {'status': 'Uncertain', 'electrolysis_mt': 13.017, 'fossil_ccus_mt': 0}])

# Figure 6.2, p. 173: investment in low-emissions production installations (USD billion, 2025)
inv = {2022: ((0.057, 0.131, 0.065, 0.417), (0.041, 0.164, 0.18, 0.065)), 2023: ((0.376, 0.008, 0.196, 0.949), (0.147, 0.466, 0.262, 0.09)),
       2024: ((0.695, 0.008, 0.27, 1.088), (0.286, 0.532, 0.769, 0.221)), 2025: ((1.178, 0, 0.27, 1.12), (0.483, 1.088, 1.742, 0.769)),
       2026: ((1.668, 0, 0.204, 0.973), (0.188, 1.644, 3.247, 2.159))}
rows = []
for y, (c_, e_) in inv.items():
    for i, k in enumerate(['United States', 'China', 'Europe', 'Other']):
        rows.append({'year': y, 'estimate': y == 2026, 'region': k, 'ccus_usd_bn': c_[i], 'electrolysis_usd_bn': e_[i]})
save('investment', rows)

# Figure 3.20, p. 111: production cost ranges (USD(2025)/kg H2), fossil pathways read from the chart (gridlines 0 at y=248.4, 10 at y=142.8)
px = lambda y: round((248.4 - y) / 10.56, 2)
cost = [('Natural gas', 2022, 235.5, 151.4), ('Natural gas', 2025, 238.5, 202.0), ('Natural gas', 2030, 241.8, 209.5),
        ('Natural gas with CCUS', 2022, 228.6, 141.0), ('Natural gas with CCUS', 2025, 232.1, 196.5), ('Natural gas with CCUS', 2030, 236.6, 200.3),
        ('Coal', 2025, 234.4, 201.5), ('Coal', 2030, 234.3, 196.1), ('Coal with CCUS', 2025, 230.4, 198.6), ('Coal with CCUS', 2030, 230.7, 201.5),
        ('Onshore wind electrolysis', 2030, 227.5, 143.3)]
rows = [{'pathway': p, 'year': y, 'low_usd_kg': px(lo), 'high_usd_kg': px(hi), 'source': 'Figure 3.20'} for p, y, lo, hi in cost]
rows += [{'pathway': 'Renewable electrolysis', 'year': 2025, 'low_usd_kg': 3.0, 'high_usd_kg': 12.0, 'source': 'Text p. 111: over USD 3/kg to well above USD 10/kg; chart capped at 12'},
         {'pathway': 'Renewable electrolysis, best sites', 'year': 2030, 'low_usd_kg': 2.0, 'high_usd_kg': 4.0, 'source': 'Text p. 112: below USD 2/kg in northern China; just above 3 and below 4 in the Middle East, India and Chile'}]
save('production_cost', rows)

# Single figures from the report text
facts = [
 ('demand_2025', 'Hydrogen demand, 2025', 102.3, 'Mt', 'p. 45, Figure 2.1'),
 ('demand_growth', 'Demand growth in 2025', 3, '%', 'p. 45'),
 ('co2', 'CO2 from hydrogen production, 2025', 1000, 'Mt CO2', 'p. 83'),
 ('low_em_2025', 'Low-emissions production, 2025', 0.88, 'Mt', 'p. 84, Figure 3.2'),
 ('low_em_growth', 'Growth in low-emissions production, 2025', 20, '%', 'p. 83'),
 ('electrolysis_2025', 'Installed electrolysis, 2025', 4.15, 'GW', 'p. 90, Figure 3.8'),
 ('china_share_electrolysis', 'China share of installed electrolysis', 64, '%', 'p. 90, Figure 3.8'),
 ('manufacturing_2025', 'Electrolyser manufacturing capacity, 2025', 58, 'GW/yr', 'p. 95'),
 ('deployment_2030', 'Expected yearly electrolyser deployment to 2030 (FID or strong potential)', 9, 'GW/yr', 'p. 95'),
 ('manufacturing_2030', 'Electrolyser manufacturing capacity expected by 2030', 95, 'GW/yr', 'p. 96'),
 ('pipeline_2030', 'Announced low-emissions production by 2030', 27, 'Mt', 'p. 11'),
 ('pipeline_2030_prev', 'Same pipeline in the 2025 review', 37, 'Mt', 'p. 11'),
 ('committed_2030', 'Committed production by 2030 (operational or FID)', 4.3, 'Mt', 'p. 87'),
 ('at_risk', 'Announced production that needs a decision by early 2027', 22, 'Mt', 'p. 12'),
 ('offtake', 'New offtake agreements, 2025', 1.7, 'Mt', 'p. 13'),
 ('investment_2025', 'Investment in low-emissions production, 2025', 6.65, 'USD bn', 'p. 173, Figure 6.2'),
 ('public_funding', 'Public funding in policies updated since the 2025 review', 41, 'USD bn', 'p. 193'),
 ('strategies', 'National hydrogen strategies', 66, 'countries', 'p. 193'),
 ('capex_china', 'Electrolyser CAPEX in China, 2025', 820, 'USD/kW', 'p. 111'),
 ('capex_row', 'Electrolyser CAPEX elsewhere, 2025', 2200, 'USD/kW', 'p. 111'),
 ('brazil_urea_imports', 'Brazil urea imports', 8.3, 'Mt', 'p. 22'),
 ('brazil_urea_me', 'Share of Brazil urea demand met by Middle East imports', 40, '%', 'p. 22'),
 ('brazil_nib', 'Nova Indústria Brasil budget, 2024-26', 58, 'USD bn', 'p. 209'),
 ('brazil_h2_projects', 'Renewable hydrogen projects selected by Nova Indústria Brasil', 44, 'projects', 'p. 209'),
 ('pecem_loan', 'World Bank loan for ammonia infrastructure at Pecém', 90, 'USD m', 'p. 177'),
]
save('key_facts', [{'id': i, 'label': l, 'value': v, 'unit': u, 'source': 'IEA Global Hydrogen Review 2026, ' + s} for i, l, v, u, s in facts])
print('ok', sorted(os.listdir(out)))

# ---- country level -------------------------------------------------------
# map_name = the country's name in the world-atlas outlines
MAP = {'United States': 'United States of America', 'Korea': 'South Korea', 'Türkiye': 'Turkey', 'Viet Nam': 'Vietnam'}
mname = lambda c: MAP.get(c, c)

# Figure 7.3, p. 199: progress toward national 2030 targets, as a share of the (maximum) target, read from the bars
tg = [('Netherlands', 'capacity', 0.7, 36.1, 73.9), ('Austria', 'capacity', 3.1, 14.6, 6.0), ('United Kingdom', 'capacity', 0.4, 2.8, 18.1),
      ('Germany', 'capacity', 2.2, 11.1, 6.7), ('Belgium', 'capacity', 0.9, 16.7, 0), ('Colombia', 'capacity', 0, 0, 16.3), ('Paraguay', 'capacity', 0, 14.5, 0),
      ('Portugal', 'capacity', 0, 3.5, 10.2), ('France', 'capacity', 1.1, 6.2, 5.0), ('Czechia', 'capacity', 0, 0, 7.5), ('Romania', 'capacity', 0.2, 6.0, 0),
      ('Hungary', 'capacity', 5.4, 0, 0), ('Denmark', 'capacity', 1.5, 0, 0.3), ('Poland', 'capacity', 1.4, 0.2, 0), ('Estonia', 'capacity', 0.8, 0, 0),
      ('Costa Rica', 'capacity', 0, 0, 0), ('Lithuania', 'capacity', 0, 0.2, 0), ('Türkiye', 'capacity', 0, 0, 0), ('Ecuador', 'capacity', 0, 0, 0), ('Uruguay', 'capacity', 0, 0, 0),
      ('United Arab Emirates', 'production', 5.0, 0, 0), ('Viet Nam', 'production', 0, 4.6, 0), ('India', 'production', 0, 1.9, 2.3), ('Australia', 'production', 0, 0.2, 2.2),
      ('South Africa', 'production', 0.4, 0, 0), ('Korea', 'production', 0, 0, 0), ('Egypt', 'production', 0, 0, 0.5), ('Argentina', 'production', 0, 0, 0),
      ('Namibia', 'production', 0, 0, 0), ('Mauritania', 'production', 0, 0, 0), ('Panama', 'production', 0, 0, 0), ('Tunisia', 'production', 0, 0, 0)]
save('country_targets', [{'country': c, 'map_name': mname(c), 'target_type': t, 'operational_pct': a, 'committed_pct': r2(a + b), 'with_strong_potential_pct': r2(a + b + s)} for c, t, a, b, s in tg])

# Figure 1.2, p. 24: dependence on imports (share of demand) and on imports from the Middle East, 2024, read from the bubble positions
dep = {'Ammonia': [('India', 9.2, 11.7), ('Morocco', 41.4, 100), ('Korea', 46.8, 100), ('South Africa', 15.9, 41.8), ('Türkiye', 18.7, 24.6),
                   ('China', 0.2, 1.6), ('Japan', 5.0, 28.5), ('Thailand', 13.3, 100), ('Brazil', 4.2, 75.4)],
       'Urea': [('India', 12.8, 18.1), ('Brazil', 40.4, 100), ('Australia', 67.9, 100), ('South Africa', 77.8, 100), ('United States', 13.4, 28.6),
                ('Türkiye', 50.4, 86.8), ('Thailand', 84.2, 100), ('Bangladesh', 37.5, 38.0), ('Mexico', 33.2, 91.9), ('New Zealand', 40.9, 69.3), ('Sri Lanka', 88.9, 100)],
       'Methanol': [('China', 11.5, 16.1), ('India', 93.0, 95.9), ('Japan', 48.8, 100), ('Korea', 31.2, 100), ('Malaysia', 23.0, 23.5), ('Indonesia', 28.0, 62.0),
                    ('Thailand', 64.7, 100), ('Singapore', 55.2, 100), ('Netherlands', 14.5, 100)]}
save('import_dependence', [{'country': c, 'map_name': mname(c), 'product': p, 'import_share_pct': y, 'middle_east_share_pct': x} for p, L in dep.items() for c, x, y in L])
print('country files ok')
