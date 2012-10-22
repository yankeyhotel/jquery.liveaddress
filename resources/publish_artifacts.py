"""
This script is used by SmartyStreets when deploying a new version of the jquery.liveaddress plugin.
"""


import os.path as path
import os
from boto.s3.bucket import Bucket
from boto.s3.connection import S3Connection
from boto.s3.key import Key
from utils import get_mime_type


def main():
    authenticate()

    connection = S3Connection(os.environ['aws-access-id'], os.environ['aws-secret-key'])
    bucket = Bucket(connection, S3_BUCKET)

    publish(bucket)


def authenticate():
    if 'aws-access-id' not in os.environ:
        os.environ['aws-access-id'] = raw_input('Enter the aws access id: ')
    if 'aws-secret-key' not in os.environ:
        os.environ['aws-secret-key'] = raw_input('Enter the aws-secret-key: ')


def publish(bucket):
    for root, dirs, files in os.walk(WORKING_DIRECTORY):
        for f in files:
            if f not in EXCLUDES:
                upload_to_s3(path.join(root, f), bucket)


def upload_to_s3(resource, bucket):
    entry = Key(bucket)
    entry.key = path.join(DESTINATION, path.basename(resource))
    entry.set_metadata('Content-Encoding', 'gzip')
    entry.set_metadata('Content-Type', get_mime_type(resource))

    print 'Publishing {0} to {1}...'.format(resource, entry.key)
    entry.set_contents_from_filename(resource)


EXCLUDES = ['.DS_Store']
DESTINATION = '/jquery.liveaddress/2.0/'
WORKING_DIRECTORY = './working/'
S3_BUCKET = 'liveaddress'


if __name__ == '__main__':
    main()