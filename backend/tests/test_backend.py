import io, json, os, sys, urllib.parse
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import geo
from fastapi.testclient import TestClient
import main

class R(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self, *a): pass

def fake(req, timeout=0):
    u = req.full_url if hasattr(req, 'full_url') else req
    if 'nominatim' in u and '/reverse' in u:
        return R(json.dumps({"lat":"28.52","lon":"77.2","display_name":"Saket, Delhi","address":{"suburb":"Saket","state":"Delhi","ISO3166-2-lvl4":"IN-DL"}}).encode())
    if 'nominatim' in u:
        return R(json.dumps([{"lat":"28.5245","lon":"77.2066","display_name":"B-14, Saket, New Delhi","address":{"city":"New Delhi","state":"Delhi","ISO3166-2-lvl4":"IN-DL"}}]).encode())
    if 'overpass' in u:
        ring=[{"lon":77.20655,"lat":28.52445},{"lon":77.20670,"lat":28.52445},{"lon":77.20670,"lat":28.52455},{"lon":77.20655,"lat":28.52455},{"lon":77.20655,"lat":28.52445}]
        return R(json.dumps({"elements":[{"id":7,"tags":{"building":"yes"},"geometry":ring}]}).encode())
    if 'jrc.ec.europa' in u:
        q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
        e = 1600 - abs(float(q['angle'][0]) - 25) * 3
        if q.get('usehorizon'): e *= 0.9
        return R(json.dumps({"outputs":{"totals":{"fixed":{"E_y":e}}}}).encode())
    raise AssertionError(u)
geo.urllib.request.urlopen = fake
c = TestClient(main.app); fails = 0
def ok(cond, msg):
    global fails; print(('PASS ' if cond else 'FAIL ') + msg); fails += (not cond)

g = c.get('/geocode', params={'q':'Saket Delhi'}).json()
ok(g[0]['stateCode']=='DL' and g[0]['city']=='New Delhi' and 'lat' in g[0], f'geocode adds stateCode/city: {g[0]["stateCode"]}')
r = c.get('/reverse', params={'lat':28.52,'lon':77.2}).json()
ok(r['found'] and r['stateCode']=='DL', 'reverse returns place + stateCode')
b = c.get('/building', params={'lat':28.5245,'lon':77.20662}).json()
ok(b['found'] and b['containsPoint'] and len(b['polygon'])==5, f'building polygon, area {b["areaM2"]} m2')
y = c.post('/yield', json={'lat':28.5,'lon':77.2,'tilts':[5,25]}).json()
h = c.post('/yield', json={'lat':28.5,'lon':77.2,'tilts':[5,25],'horizon':[10]*36}).json()
ok(h['25'] < y['25'], f'horizon lowers yield {y["25"]} -> {h["25"]}')
f = c.post('/finance', json={'kwp':3,'stateCode':'DL','monthlyBill':3000,'kwhPerKwp':1500}).json()
ok(f['subsidy']==78000 and f['paybackRange'], f'finance ok: payback {f["paybackRange"]}')
e = c.get('/reverse', params={'lat':'x','lon':1}); ok(e.status_code==422 and 'hint' in e.json(), 'bad input -> {error,hint}')
ok(c.get('/').json()['routes'].count('/reverse')==1, 'root lists /reverse')
print('ALL PASSED' if not fails else f'{fails} FAILED'); sys.exit(fails>0)
