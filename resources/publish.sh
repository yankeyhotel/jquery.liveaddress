python tag.py
git push origin --tags
python minify.py
python publish_artifacts.py
echo "Don't forget to publish to npm using cd ../ && npm publish"
