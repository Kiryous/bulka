'use strict';

const gulp = require('gulp'),
  util = require('gulp-util'),
  fs = require('fs'),
  rename = require('gulp-rename'),
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
  svgSprite = require('gulp-svg-sprites'),
  webpackConfig = require('./config/webpack.config'),
  browserSync = require('browser-sync');

const env = util.env,
  PROXY = env.proxy || false, // --proxy=domain.local
  PRODUCTION = !!env.production, // --production
  BUILD_SCRIPTS_INITIALLY = env['inital-scripts']; // --initial-scripts

function clean(...list) {
  return [].concat(...list.filter(Boolean));
}

const SRC_DIR = './source';
const src = {
  base: SRC_DIR,
  styles: SRC_DIR + '/styles',
  scripts: SRC_DIR + '/scripts',
  images: SRC_DIR + '/images',
  fonts: SRC_DIR + '/fonts',
  icons: SRC_DIR + '/icons',
  svg: SRC_DIR + '/svg'
};

const BUILD_DIR = './';
const build = {
  base: BUILD_DIR,
  styles: BUILD_DIR + 'css',
  scripts: BUILD_DIR + 'js',
  images: BUILD_DIR + 'img',
  fonts: BUILD_DIR + 'fonts',
  icons: BUILD_DIR + 'icons',
  svg: BUILD_DIR + 'svg'
};

function __errorHandler(taskName) {
  return { errorHandler: plumberErrorHandler(`${taskName} build failed!`) };
}

function startBS() {
  if (!PROXY) return;
  browserSync.init({
    notify: false,
    proxy: PROXY,
    serveStatic: [
      {
        route: '/static',
        dir: './'
      }
    ]
  });
}

const postcssProcessors = [
  require('postcss-import')(),
  require('postcss-mixins')(),
  require('postcss-cssnext')(),
  require('postcss-nested')(),
  require('postcss-inline-svg')
];

var styleTasks = [];
fs.readdirSync(src.styles).map(function(filename) {
  var taskName = filename.out.split('.')[0];
  styleTasks.push(taskName);
  gulp.task(taskName, function() {
    return (
      gulp
        .src(`${src.styles}/${filename}`)
        // TODO: changed
        .pipe(plumber(__errorHandler(`Styles (${taskName})`)))
        .pipe(postcss(postcssProcessors))
        .pipe(rename(filename))
        .pipe(PRODUCTION ? csso({ debug: true }) : util.noop())
        .pipe(gulp.dest(build.styles))
        .pipe(browserSync.stream())
    );
  });
});

// Copy styles vendors
gulp.task('copy-vendor-styles', () => {
  return gulp.src(`${src.styles}/vendors/*`).pipe(gulp.dest(build.styles));
});

// Build for serve
gulp.task('build', function() {
  gulp.start.apply(
    this,
    [].concat(
      'opt-images',
      'opt-svg',
      'sprites',
      'copy-vendor-styles',
      styleTasks,
      'scripts-deps',
      'scripts-deps-legacy',
      'scripts-main'
    )
  );
});

// Run live
gulp.task('default', function() {
  gulp.start.apply(
    this,
    clean(
      'opt-images',
      'opt-svg',
      'sprites',
      'copy-vendor-styles',
      BUILD_SCRIPTS_INITIALLY && 'scripts-deps',
      BUILD_SCRIPTS_INITIALLY && 'scripts-deps-legacy',
      BUILD_SCRIPTS_INITIALLY && 'scripts-main',
      styleTasks,
      ['watch']
    )
  );
});

// Федеральная служба по контролю за оборотом файлов
gulp.task('watch', function() {
  startBS();
  gulp.watch(src.styles + '/**/*.css', styleTasks);
  gulp.watch(`${src.styles}/vendors` + '/**/*.css', ['copy-vendors-styles']);
  gulp.watch(src.scripts + '/**/*.js', ['scripts-main']);
  gulp.watch(src.scripts + '/vendors/**/*.js', [
    'scripts-deps',
    'scripts-deps-legacy'
  ]);
  gulp.watch(src.images + '/**/*.{png,svg,jpg,jpeg,gif, ico}', ['opt-images']);
  gulp.watch(src.svg + '/**/*.svg', ['opt-svg']);
  gulp.watch(src.images + '/**/*.svg', ['sprites']);
  gulp.watch(['../templates/**/*']).on('change', browserSync.reload);
});

gulp.task('watch-js', function() {
  startBS();
  gulp.watch(src.scripts + '/**/*.js', ['scripts-main']);
});

gulp.task('scripts-deps', function() {
  return gulp
    .src(`${src.scripts}/vendors/*.js`)
    .pipe(plumber(__errorHandler('Dependencies scripts')))
    .pipe(concat(`vendors.js`))
    .pipe(uglify())
    .pipe(gulp.dest(build.scripts))
    .pipe(browserSync.stream())
});

gulp.task('scripts-main', () => {
  return webpackStream(webpackConfig, webpack)
    .pipe(plumber(__errorHandler('Main scripts')))
    .pipe(gulp.dest(build.scripts))
    .pipe(browserSync.stream());
});

// Make images to weight less TODO: tinypng or something like that
gulp.task('opt-images', () => {
  return gulp
    .src(src.images + '/**/*.{png,svg,jpg,jpeg,gif,ico}')
    .pipe(changed(build.images))
    .pipe(plumber(__errorHandler('Opt images')))
    .pipe(
      imagemin({
        progressive: true,
        svgoPlugins: [{ removeViewBox: false }],
        use: [pngquant()]
      })
    )
    .pipe(gulp.dest(build.images));
});

gulp.task('opt-svg', () => {
  return (
    gulp
      .src(src.svg + '/**/*.svg')
      .pipe(plumber(__errorHandler('Opt svg')))
      .pipe(
        imagemin([
          imagemin.svgo({
            plugins: [
              { removeViewBox: false },
              { cleanupIDs: false },
              { convertStyleToAttrs: false },
              { removeDimensions: false },
              { removeUselessDefs: false }
            ]
          })
        ])
      )
      .pipe(gulp.dest(build.svg))
  );
});

gulp.task('sprites', function() {
  return gulp
    .src(src.icons + '/**/*.svg')
    .pipe(plumber(__errorHandler('SVG sprites')))
    .pipe(
      svgSprite({
        mode: 'symbols',
        preview: false,
        svg: {
          symbols: 'symbols.svg'
        }
      })
    )
    .pipe(gulp.dest(build.icons));
});
