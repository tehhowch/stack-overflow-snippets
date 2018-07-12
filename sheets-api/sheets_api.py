# stdlib imports
import csv
import json
import time
from pprint import pprint

# Google API imports
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.metadata']

def get_saved_credentials(filename='creds.json'):
    '''Read in any saved OAuth data/tokens
    '''
    fileData = {}
    try:
        with open(filename, 'r') as file:
            fileData: dict = json.load(file)
    except FileNotFoundError:
        return None
    if fileData and 'refresh_token' in fileData and 'client_id' in fileData and 'client_secret' in fileData:
        return Credentials(**fileData)
    return None


def store_creds(credentials, filename='creds.json'):
    if not isinstance(credentials, Credentials):
        return
    fileData = {'refresh_token': credentials.refresh_token,
                'token': credentials.token,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'token_uri': credentials.token_uri}
    with open(filename, 'w') as file:
        json.dump(fileData, file)
    print(f'Credentials serialized to {filename}.')


def get_credentials_via_oauth(filename='client_secret.json', scopes=SCOPES, saveData=True) -> Credentials:
    '''Use data in the given filename to get oauth data
    '''
    iaflow: InstalledAppFlow = InstalledAppFlow.from_client_secrets_file(filename, scopes)
    iaflow.run_local_server()
    if saveData:
        store_creds(iaflow.credentials)
    return iaflow.credentials


def get_service(credentials, service='sheets', version='v4'):
    return build(service, version, credentials=credentials)

def get_cells_with_color(sheets, wbId: str, sheetId: str, color: str=None, range: str=None):
    params = {'spreadsheetId': wbId}
    if range:
        params['ranges'] = [range]
    params['fields'] = "sheets(data(rowData(values(effectiveFormat/backgroundColor,formattedValue)),startColumn,startRow),properties(sheetId,title))"
    return sheets.spreadsheets().get(**params).execute()

if __name__ == '__main__':
    print('Executing')
    creds = get_saved_credentials()
    if not creds:
        creds = get_credentials_via_oauth()
    sheets = get_service(creds)
    # Example for getting color & value data
    celldata = get_cells_with_color(sheets, '1P8UDv4j2lPM0hAKw4EbBT_GtvlOgFYeARV16NzWA6pc', '', range='Scoreboard!A1:H')
    dataset = []
    default_bg = {'red': 1, 'green': 1, 'blue': 1}
    # all_data['sheets'] is a list of sheet resources (per the API spec.)
    for sheet in celldata['sheets']:
        # The sheet resource is a dict with keys determined by what we requested in fields
        # (i.e.  properties (->sheetId, ->title), data)
        print('Sheet name is {title} with grid id {sheetId}'.format_map(sheet["properties"]))
        # each range in data will only contain startRow and/or startColumn if they are not 0
        # (i.e.  if you grab A1:___, you won't have startRow or startColumn)
        for range in sheet['data']:
            rowData = range.get('rowData', [])
            if not rowData:
                continue
            offsets = {'row': range.get('startRow', 0),
                        'col': range.get('startColumn', 0)}
            rangeBGs = [default_bg] * offsets['row']
            rangeValues = [''] * offsets['row']
            for row in rowData:
                colData = row['values']
                newBGs = [default_bg] * offsets['col']
                newVals = [''] * offsets['col']
                for col in colData:
                    try:
                        newBGs.append(col['effectiveFormat']['backgroundColor'])
                    except KeyError:
                        newBGs.append(default_bg) # Shouldn't get called since all cells have a background color
                    try:
                        newVals.append(col['formattedValue']) # Always a string if present.
                    except KeyError:
                        newVals.append('') # Not all cells have a value.
                rangeBGs.append(newBGs)
                rangeValues.append(newVals)
            dataset.append({'sheetId': sheet['properties']['sheetId'],
                            'sheetName': sheet['properties']['title'],
                            'backgrounds': rangeBGs,
                            'values': rangeValues})
    # dataset is now a list with elements that correspond to the requested
    # ranges,
    # and contain 0-base row and column indexed arrays of the backgrounds and
    # values:
    # Color in A1 of 1st range:
    r1 = dataset[0]
    print(f'Cell A1 color is {r1["backgrounds"][0][0]} and has value {r1["values"][0][0]}')
    print(f'Cell D2 color is {r1["backgrounds"][3][1]} and has value {r1["values"][3][1]}')
