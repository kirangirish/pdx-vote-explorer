import requests
from bs4 import BeautifulSoup

url = 'https://www.portland.gov/council/votes'
headers = {'User-Agent': 'Mozilla/5.0'}
response = requests.get(url, headers=headers)
soup = BeautifulSoup(response.text, 'html.parser')
# Look for tables or lists commonly used for records
for table in soup.find_all('table'):
    print(table.get('class'))
    print(table.find_all('th'))
