''' sheets_api.py
Copyright (c) 2018 by tehhowch
This is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later version.
This is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.  See the GNU General Public License for more details.
'''

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
    try:
        iaflow: InstalledAppFlow = InstalledAppFlow.from_client_secrets_file(filename, scopes)
    except FileNotFoundError as err:
        print('Unable to authorize - missing client secret information file.', err)
    else:
        iaflow.run_local_server()
        if saveData:
            store_creds(iaflow.credentials)
        return iaflow.credentials

def get_service(credentials, service='sheets', version='v4'):
    if not credentials:
        print(f'No credentials given. Attempting to build service {service}{version} with application default credentials.')
    return build(service, version, credentials=credentials)



def get_cells_with_color(sheets, wbId: str, range: str=None):
    '''Example function that requests the string value and background color of the given workbook and range'''
    params = {'spreadsheetId': wbId}
    if range:
        params['ranges'] = [range]
    params['fields'] = "sheets(data(rowData(values(effectiveFormat/backgroundColor,formattedValue)),startColumn,startRow),properties(sheetId,title))"
    return sheets.spreadsheets().get(**params).execute()

def colors_example(service):
    # Example for getting color & value data
    wbId = input("Enter the 41-character spreadsheet ID")
    queriedRange = input("Enter the range to acquire, e.g. 'Arbitrary Sheet Name'!A1:K")
    celldata = get_cells_with_color(service, wbId, range=queriedRange)

    dataset = []
    default_bg = {'red': 1, 'green': 1, 'blue': 1}
    # celldata['sheets'] is a list of sheet resources (per the API spec.)
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



def get_existing_basic_filters(service, wkbkId: str) -> dict:
    params = {'spreadsheetId': wkbkId,
              'fields': 'sheets(properties(sheetId,title),basicFilter)'}
    response = service.spreadsheets().get(**params).execute()
    # Create a sheetId-indexed dict from the result
    filters = {}
    for sheet in response['sheets']:
        if 'basicFilter' in sheet:
            filters[sheet['properties']['sheetId']] = sheet['basicFilter']
    return filters

def clear_filters(service, wkbkId: str, known_filters: dict):
    requests = []
    for sheetId, filter in known_filters.items():
        requests.append({'clearBasicFilter': {'sheetId': sheetId}})
    if not requests:
        return
    params = {'spreadsheetId': wkbkId,
              'body': {'requests': requests}}
    service.spreadsheets().batchUpdate(**params).execute()

def apply_filters(service, wkbkId: str, filters: dict):
    # All requests are validated before any are applied, so bundling the set and clear filter
    # operations in the same request would fail: only 1 basic filter can exist at a time.
    clear_filters(service, wkbkId, filters)
    
    requests = []
    for sheetId, filter in filters.items():
        # By removing the starting and ending indices from the 'range' property,
        # we ensure the basicFilter will apply to the entire sheet bounds. If one knows the 
        # desired values for startColumnIndex, startRowIndex, endRowIndex, endColumnIndex,
        # then they can be used to create a range-specific basic filter.
        filter['range'] = {'sheetId': sheetId}
        requests.append({'setBasicFilter': {'filter': filter}})
    if not requests:
        return
    params = {'spreadsheetId': wkbkId,
              'body': {'requests': requests}}
    service.spreadsheets().batchUpdate(**params).execute()

def filter_example(service):
    wkbkId = input("Enter the 41-character spreadsheet ID")
    currentFilters = get_existing_basic_filters(service, wkbkId)
    pprint(currentFilters)
    apply_filters(service, wkbkId, currentFilters)
    pprint(get_existing_basic_filters(service, wkbkId))



if __name__ == '__main__':
    print('Executing')
    creds = get_saved_credentials()
    if not creds:
        creds = get_credentials_via_oauth()
    sheets = get_service(creds)
    