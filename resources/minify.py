"""
This script is used by SmartyStreets when deploying a new version of the jquery.liveaddress plugin.
"""


import gzip
import shutil
import subprocess
import os


SOURCE = '../src'
WORKING = './working'
JQUERY_PLUGIN = 'jquery.liveaddress.js'
IMAGE = 'dots.gif'
MINIFICATION_ERROR = 'ERROR: A file failed the minification process ({0}). '
SOURCE_FILE = os.path.join(SOURCE, JQUERY_PLUGIN)
WORKING_FILE = os.path.join(WORKING, JQUERY_PLUGIN)
MINIFIED_FILE = WORKING_FILE.replace('.js', '.min.js')


def main():
    prepare()
    compress_javascript()
    copy_artifacts()


def prepare():
    if os.path.exists(WORKING):
        shutil.rmtree(WORKING)
    os.mkdir(WORKING)


def compress_javascript():
    shutil.copy(SOURCE_FILE, WORKING_FILE)
    minify(WORKING_FILE, MINIFIED_FILE)
    gzip_file(WORKING_FILE)
    gzip_file(MINIFIED_FILE)


def minify(filename, destination):
    print 'Minifying [{0}]'.format(filename)
    return_code = subprocess.call(yui_args(filename, destination))
    if return_code:
        raise RuntimeError(MINIFICATION_ERROR.format(filename))


def yui_args(filename, destination):
    return ['java', '-jar', 'yuicompressor-2.4.7.jar', filename, '-o', destination]


def gzip_file(source):
    print 'gzipping [{0}]'.format(source)
    with open(source, 'rb') as s:
        original = s.read()

    with gzip.open(source, 'wb') as d:
        d.write(original)


def copy_artifacts():
    destination = os.path.join(WORKING, 'dots.gif')
    shutil.copy(os.path.join(SOURCE, 'dots.gif'), destination)
    gzip_file(destination)


if __name__ == '__main__':
    main()