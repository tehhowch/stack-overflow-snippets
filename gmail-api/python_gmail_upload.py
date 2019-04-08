''' python_gmail_upload.py
Copyright (c) 2019 by tehhowch
This is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later version.
This is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.  See the GNU General Public License for more details.
'''
# This file was developed in response to the Stack Overflow question located here:
# https://stackoverflow.com/questions/55542231/how-to-attach-large-files-to-an-email-using-python-gmail-api

# stdlib imports
import base64
import json
import os
from email import utils, encoders
from email.mime import application, multipart, text, base, image, audio
from email.mime.multipart import MIMEMultipart
import mimetypes
from io import BytesIO

# Google API imports
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
# I use an installed app flow, as I have no service account to test with
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/gmail.send']

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

def get_service(credentials, service='gmail', version='v1'):
    '''Create an authorized (or default-authorized) service objec'''
    if not credentials:
        print(f'No credentials given. Attempting to build service {service}{version} with application default credentials.')
    return build(service, version, credentials=credentials)

def create_message(parts: dict, body: str, as_html: bool = False) -> MIMEMultipart:
    '''Construct a basic MIME email message.
    '''
    required = ('to',)
    optional = ('from', 'subject', 'cc', 'bcc',)

    message = multipart.MIMEMultipart()
    for key in required:
        message[key] = parts[key] # Raises KeyError if not provided.
    for key in optional:
        if key in parts:
            message[key] = parts[key]
    if not 'date' in message:
        message['date'] = utils.formatdate(localtime=True)
    if body:
        message.attach(text.MIMEText(body,
            _subtype='html' if as_html else 'plain',
            _charset='utf-8'))
    return message

def add_attachments(email: MIMEMultipart, attachments: list, max_MB: int = 25):
    '''Add the given attachments to the given email, up to the specified maximum size.
    '''
    mime_consumer = {'text': text.MIMEText,
                     'image': image.MIMEImage,
                     'audio': audio.MIMEAudio }

    sz = len(bytes(email))
    added = 0
    count = 0
    for f in attachments:
        print(sz / 1024 / 1024)
        margin = max_MB * 1024 * 1024 - sz
        if margin <= 100000:
            print(f'Message size limit reached. Added first {count} of {len(attachments)}')
            break
        mimetype, encoding = mimetypes.guess_type(f)
        if mimetype is None or encoding is not None:
            mimetype = 'application/octet-stream'
        main_type, sub_type = mimetype.split('/', 1)

        consumer = mime_consumer[main_type] if (main_type in mime_consumer) else (
            application.MIMEApplication if (main_type == 'application' and sub_type == 'pdf') else None
        )
        attachment = None
        if consumer is None:
            # Use the base mimetype
            attachment = base.MIMEBase(main_type, sub_type)
            with open(f, 'rb') as source:
                attachment.set_payload(source.read())
        else:
            # Use the known conversion.
            print(f'Reading file of type {main_type}')
            with open(f, 'rb') as source:
                attachment = consumer(source.read(), _subtype=sub_type)

        encoders.encode_base64(attachment)
        attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(f))
        if len(bytes(attachment)) >= margin:
            margin = 0 # Add your own "skip this file" or "these should be links from Drive" logic.
        else:
            added = len(bytes(attachment))
            sz += added
            count += 1
            email.attach(attachment)
    print(f'Email size is now ~{len(bytes(email)) / 1024 / 1024} MB')

def locate_attachments():
    '''This just grabs files in a directory for testing. You probably have actual specific
    files you want to attach, and thus you should use whatever business logic is relevant.
    '''
    paths = []
    for dpath, _, filenames in os.walk('../../endless-sky-projects/endless-sky/images/ship'):
        print(f'Found {len(filenames)} files in {dpath}')
        paths += [os.path.join(dpath, name) for name in filenames]
        print(f'Total found: {len(paths)}')
    return paths

if __name__ == '__main__':
    print('Executing')
    parts = {'to': 'example@example.com', 'subject': 'Sending Via Resumable Upload'}
    msg = create_message(parts, "Hello there, Stack Overflow!", False)
    to_attach = locate_attachments()
    add_attachments(msg, to_attach)

    creds = get_saved_credentials()
    if not creds:
        creds = get_credentials_via_oauth()
    gmail = get_service(creds)

    media = MediaIoBaseUpload(BytesIO(msg.as_bytes()), mimetype='message/rfc822', resumable=True)
    res = gmail.users().messages().send(userId='me',
                                        body={},
                                        media_body=media).execute()
    print(res)
