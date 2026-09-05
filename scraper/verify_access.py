import requests

try:
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    response = requests.get('https://www.portland.gov/council/votes', headers=headers, timeout=10)
    print(f'Status Code: {response.status_code}')
    if response.status_code == 200:
        print('Successfully accessed the page.')
    else:
        print('Failed to access the page.')
except Exception as e:
    print(f'Error: {e}')
