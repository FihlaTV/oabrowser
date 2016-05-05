const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const babel = require('gulp-babel');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const clean = require('gulp-clean');
const templateCache = require('gulp-angular-templatecache');

const filesList = [
        "bower_components/jquery/dist/jquery.js",
        "libs/jquery.mousewheel.js",
        "bower_components/angular/angular.js",
        "bower_components/angular-sanitize/angular-sanitize.js",
        "bower_components/bootstrap/dist/js/bootstrap.js",
        "bower_components/angular-animate/angular-animate.min.js",
        "libs/ui-bootstrap-tpls-1.3.1.min.js",
        "bower_components/adapt-strap/dist/adapt-strap.min.js",
        "bower_components/adapt-strap/dist/adapt-strap.tpl.min.js",
        "libs/ui-layout.js",
        "libs/rzslicer.js",
        "libs/firebase.js",
        "libs/angularfire.min.js",
        "babel/angularInit.js",
        "tmp/templates.js",
        "babel/mainAppProvider.js",
        "babel/atlasJsonProvider.js",
        "babel/objectSelectorProvider.js",
        "babel/volumesManagerProvider.js",
        "babel/crosshairProvider.js",
        "babel/firebaseViewService.js",
        "babel/insertTreeDirective.js",
        "babel/insertBreadcrumbs.js",
        "babel/insertSliceDirective.js",
        "babel/mainToolbarDirective.js",
        "babel/layoutController.js",
        "babel/modalController.js",
        "babel/headerController.js",
        "libs/three.js",
        "libs/TrackballControls.js",
        "babel/Volume.js",
        "babel/VolumeSlice.js",
        "babel/MultiVolumesSlice.js",
        "babel/NRRDLoader.js",
        "babel/VTKLoader.js",
        "libs/Detector.js",
        "libs/stats.min.js",
        "libs/zlib_and_gzip.min.js",
        "libs/dat.gui.min.js",
        "babel//LightKit.js",
        "libs/Tween.js",
        "babel/hierarchyGroup.js",
        "babel/app.js"
    ];

const babelFiles = [
        "angularInit.js",
        "ng-providers/mainAppProvider.js",
        "ng-providers/atlasJsonProvider.js",
        "ng-providers/objectSelectorProvider.js",
        "ng-providers/volumesManagerProvider.js",
        "ng-providers/crosshairProvider.js",
        "ng-providers/firebaseViewService.js",
        "ng-directives/insertTreeDirective.js",
        "ng-directives/insertBreadcrumbs.js",
        "ng-directives/insertSliceDirective.js",
        "ng-directives/mainToolbarDirective.js",
        "ng-controllers/layoutController.js",
        "ng-controllers/modalController.js",
        "ng-controllers/headerController.js",
        "libs/Volume.js",
        "libs/VolumeSlice.js",
        "libs/MultiVolumesSlice.js",
        "libs/NRRDLoader.js",
        "libs/VTKLoader.js",
        "libs/LightKit.js",
        "hierarchyGroup.js",
        "app.js"
    ];
gulp.task('babel', () => {
	return gulp.src(babelFiles)
		.pipe(babel({
			presets: ['es2015']
		}))
		.pipe(gulp.dest('babel'));
});

gulp.task('templates', function () {
  return gulp.src('ng-templates/**/*.html')
    .pipe(templateCache('templates.js', {
      root : 'ng-templates',
      module : 'atlasDemo'
  }))
    .pipe(gulp.dest('tmp'));
});

gulp.task('build', ['babel', 'templates'], () => {
	return gulp.src(filesList)
		.pipe(sourcemaps.init())
		.pipe(concat('all.js'))
        .pipe(uglify())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('dist'));
});

gulp.task('clean', ['babel', 'templates', 'build'], function () {
	return gulp.src(['babel','tmp'], {read: false})
		.pipe(clean());
});

gulp.task('default', ['babel', 'templates', 'build', 'clean'],function () {

});