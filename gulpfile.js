'use strict';

const
  gulp = require('gulp'),
	util = require('gulp-util'),
	// fs = require('fs'),
	// path = require('path'),
	// rename = require('gulp-rename'),
	concat = require('gulp-concat'),
	plumber = require('gulp-plumber'),
	plumberErrorHandler = require('gulp-plumber-error-handler'),
	webpack = require('webpack'),
	webpackStream = require('webpack-stream'),
  postcss = require('gulp-postcss'),
	csso = require('gulp-csso'),  
  uglify = require('gulp-uglify'),
  imagemin = require('gulp-imagemin'),
  pngquant = require('imagemin-pngquant'),
  changed = require('gulp-changed'),
  svgSprite = require("gulp-svg-sprites");

// Review
const 
	env = util.env,
	PRODUCTION = !!env.production; // --production

const atSrc = (path) => `./src/${path}`;
const atBuild = (path) => `./build/${path}`;

const src = {
  styles: atSrc('styles'),
  scripts: atSrc('scripts'),
  images: atSrc('images'),
  fonts: atSrc('fonts'),
  icons: atSrc('icons'),
};

const build = {
  styles: atBuild('css'),
  scripts: atBuild('js'),
  images: atBuild('img'),
  fonts: atBuild('fonts'),
  icons: atBuild('icons')
};

function errorHandler(taskName) {
	return {errorHandler: plumberErrorHandler(`${taskName} build failed!`)};
}

const postcssProcessors = [
  require('postcss-import')(),
  require('postcss-mixins')(),
  require('postcss-simple-vars')(),  
  require("postcss-cssnext")(),
  require("postcss-nested")(),
  require('postcss-inline-svg'),  
];

// Build styles
gulp.task('styles', function () {
  return gulp.src(`${src.styles}/` + '*.css')
    .pipe(plumber(errorHandler('Styles')))  
    .pipe(postcss(postcssProcessors))
    // .pipe(rename(build.styles))
    .pipe(PRODUCTION ? csso({debug: true}) : util.noop())
    .pipe(gulp.dest(build.styles));
});

// Copy vendor styles
gulp.task('copy-vendor-styles', () => {
	return gulp
		.src(`${src.styles}/vendors/*`)
		.pipe(gulp.dest(build.styles));
});

// Uglify and copy vendor scripts
gulp.task('scripts-deps', function() {
  return  gulp.src(`${src.scripts}/vendors/**/*.js`)
    .pipe(plumber(errorHandler('Dependencies scripts')))
    .pipe(concat(`vendors.js`))
    .pipe(uglify())
    .pipe(gulp.dest(build.scripts));
});

let webpackConfig = {
	entry: {
    // TODO: dynamic
    index: `${src.scripts}/index.js`,
  },
	output: {
		filename: '[name].js',
	},
	module: {
		rules: [{
			test: /\.js$/,
			exclude: /node_modules/,
			use: [{
				loader: 'babel-loader',
				options: {
          presets: ['es2015'],
          cacheDirectory: true
        }
			}],
		}],
	},
	devtool: 'source-map',
	plugins: [
		new webpack.optimize.OccurrenceOrderPlugin()
	]
};

let webpackUglify = new webpack.optimize.UglifyJsPlugin({
	compress: {
		warnings: false,
		screw_ie8: true,
		conditionals: true,
		unused: true,
		comparisons: true,
		sequences: true,
		dead_code: true,
		evaluate: true,
		join_vars: true,
		if_return: true,
	},
	output: {
		comments: false
	},
	sourceMap: true
});
webpackConfig.plugins.push(
  new webpack.DefinePlugin({
    PRODUCTION: JSON.stringify(Boolean(PRODUCTION))
  })
);
if (PRODUCTION) {
	webpackConfig.plugins.push(webpackUglify);
	webpackConfig.devtool = '';
}

// Build scripts
gulp.task('scripts-main', () => {
  return webpackStream(webpackConfig, webpack)
    .pipe(plumber(errorHandler('Main scripts')))
    .pipe(gulp.dest(build.scripts));
});

// Optimize images
gulp.task('opt-images', () => {
	return gulp
		.src(src.images + '/**/*.{png,svg,jpg,jpeg,gif,ico}')
		.pipe(changed(build.images))
    .pipe(plumber(errorHandler('Opt images')))
		.pipe(imagemin({
			progressive: true,
			svgoPlugins: [{removeViewBox: false}],
      use: [pngquant()],
      // imagemin.svgo({
      //   plugins: [
      //     {removeViewBox: false},
      //     {cleanupIDs: false}
      //   ]
      // })
		}))
		.pipe(gulp.dest(build.images));
});

// Build svg sprite
gulp.task('icons', function () {
  return gulp.src(src.icons + '/**/*.svg')
      .pipe(plumber(errorHandler('SVG icons')))
      .pipe(svgSprite({
        mode: "symbols", 
        preview: false,
        svg: {
          symbols: 'symbols.svg'
        }
      }))
      .pipe(gulp.dest(build.icons));
});

// Watching
gulp.task('watch', function() {
  gulp.watch(src.styles + '/**/*.css', 'styles');
  gulp.watch(`${src.styles}/vendors` + '/**/*.css', ['copy-vendors-styles']);  
  gulp.watch(src.scripts + '/**/*.js', ['scripts-main']);
  gulp.watch(src.scripts + '/vendors/**/*.js', ['scripts-deps']);  
  gulp.watch(src.images + '/**/*.{png,svg,jpg,jpeg,gif, ico,svg}', ['opt-images']); 
  gulp.watch(src.images + '/**/*.svg', ['icons']);     
});

const defaultTasks = [
  'opt-images', 
  'icons',
  'copy-vendor-styles',
  'styles', 
  'scripts-deps',
  'scripts-main',
];

// Build
gulp.task('default', function() {
  gulp.start.apply(this, defaultTasks);
});

// Build with watch
gulp.task('live', function() {
  gulp.start.apply(this,
    [].concat(
      defaultTasks,
      ['watch']
    )
  );
});