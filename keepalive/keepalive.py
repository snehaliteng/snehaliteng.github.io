import urllib.request
import urllib.error
import sys
from datetime import datetime

SUPABASE_URL = 'https://vgipghqejzbcoighktij.supabase.co'
ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaXBnaHFlanpiY29pZ2hrdGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjQ2MjIsImV4cCI6MjA5NTMwMDYyMn0.KoDwAZarGWOLwKXOwycA8wuIiIrksvZy7dyaO0-ehUo'

def keepalive():
    url = f'{SUPABASE_URL}/rest/v1/keepalive?select=*&limit=1'
    req = urllib.request.Request(url)
    req.add_header('apikey', ANON_KEY)
    req.add_header('Authorization', f'Bearer {ANON_KEY}')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode()
            print(f'[{datetime.now()}] Supabase keepalive OK — status {resp.status}')
            return True
    except urllib.error.HTTPError as e:
        print(f'[{datetime.now()}] Supabase keepalive FAILED — HTTP {e.code}: {e.reason}', file=sys.stderr)
        return False
    except urllib.error.URLError as e:
        print(f'[{datetime.now()}] Supabase keepalive FAILED — {e.reason}', file=sys.stderr)
        return False

if __name__ == '__main__':
    ok = keepalive()
    sys.exit(0 if ok else 1)
