module.exports = {
    "extends": "../../docs/checkstyle/eslintrc.js",
    "parser": "@babel/eslint-parser",
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 2017,
        "requireConfigFile": false,
	"babelOptions": {
       	   "presets": ["@babel/preset-react"]
        },
    },
    "globals": {
        "require": true,
        "cookieconsent": true
    }
};
