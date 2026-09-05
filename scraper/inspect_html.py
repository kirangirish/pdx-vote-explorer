import requests

url = 'https://www.portland.gov/council/votes'
headers = {'User-Agent': 'Mozilla/5.0'}
response = requests.get(url, headers=headers)
print(response.text[:2000]) # Print first 2000 chars to inspect structure
