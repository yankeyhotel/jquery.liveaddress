"""
This script is used by SmartyStreets when deploying a new version of the jquery.liveaddress plugin.
"""


import os.path as path
import os
import boto
from boto.s3.bucket import Bucket
from boto.s3.connection import S3Connection, OrdinaryCallingFormat
from boto.s3.key import Key
from utils import get_mime_type

def main():
    cloudfront_connection = boto.connect_cloudfront()
    s3_connection = connect_to_s3()
    bucket = Bucket(s3_connection, S3_BUCKET)
    publish(bucket, cloudfront_connection)


def connect_to_s3():
    """
    Workaround for '.' in bucket names when calling from Python 2.9+:
        https://github.com/boto/boto/issues/2836#issuecomment-77283169
    """
    if '.' in S3_BUCKET:
        return S3Connection(calling_format=OrdinaryCallingFormat())
    else:
        return S3Connection()


def publish(bucket, cloudfront):
    if 'branch' not in os.environ:
        os.environ['branch'] = raw_input('Enter the major.minor version: ')

    resources = []
    
    for root, dirs, files in os.walk(WORKING_DIRECTORY):
        for f in files:
            if f not in EXCLUDES:
                local_path = path.join(root, f)
                resource_path = upload_to_s3(local_path, bucket)
                resources.append(resource_path)
    
    distribution = os.environ.get('cloudfront_distribution_id') or raw_input('Enter the cloudfront distribution id: ')
    distribution = distribution.strip()
    if distribution:
        print "Creating cloudfront invalidation for all uploaded resources..."
        cloudfront.create_invalidation_request(distribution, resources)



def upload_to_s3(resource, bucket):
    entry = Key(bucket)
    entry.key = path.join(DESTINATION.format(os.environ['branch']), path.basename(resource))
    entry.set_metadata('Content-Encoding', 'gzip')
    entry.set_metadata('Content-Type', get_mime_type(resource))

    print 'Publishing {0} to {1}...'.format(resource, entry.key)
    entry.set_contents_from_filename(resource)
    return entry.key


EXCLUDES = ['.DS_Store']
DESTINATION = '/jquery.liveaddress/{0}'
WORKING_DIRECTORY = './working/'
S3_BUCKET = 'static.smartystreets.com'


if __name__ == '__main__':
    main()
