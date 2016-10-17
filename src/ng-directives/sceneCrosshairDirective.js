const angular = require('angular');
const throttle = require('throttle-debounce').throttle;
const templateUrl = require('../ng-templates/sceneCrosshair.html');

angular.module('atlasDemo').directive( 'sceneCrosshair', [function () {
    return {
        restrict: 'EA',
        scope: {},
        templateUrl : templateUrl,
        controller: ['$scope', '$element', 'mainApp', 'firebaseView', function ( $scope, $element, mainApp, firebaseView) {

            $scope.style = {
                stroke : "white",
                display : "none",
                top : "0px",
                left : "0px"
            };


            var canvas = $('#rendererFrame canvas'),
                debouncedCommit = throttle(150, function () {
                    if (firebaseView.isLastModifier()) {
                        firebaseView.commit('sceneCrosshair');
                    }
                });

            $scope.safeApply = function(fn) {
                //if scope has been destroyed, ie if modal has been dismissed, $root is null
                if (this.$root) {
                    var phase = this.$root.$$phase;
                    if(phase === '$apply' || phase === '$digest') {
                        if(fn && (typeof(fn) === 'function')) {
                            fn();
                        }
                    } else {
                        this.$apply(fn);
                    }
                }
            };

            function getOppositeColorOfMesh (mesh) {
                var color = mesh.material && mesh.material.color,
                    oppositeColor = new THREE.Color("white");
                if (color) {
                    var hsl = color.getHSL();
                    oppositeColor.setHSL((hsl.h+180)%360, hsl.s, hsl.l);
                }
                return oppositeColor.getStyle();
            }

            function toScreenXY(position) {
                var camera = mainApp.camera;
                if (!camera) {
                    return {x:0,y:0};
                }
                if (canvas.length === 0) {
                    canvas  = $('#rendererFrame canvas');
                }
                var pos = position.clone();
                var projScreenMat = new THREE.Matrix4();
                projScreenMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
                pos = pos.applyProjection(projScreenMat);

                return { x: ( pos.x + 1 ) * canvas.width() / 2 + canvas.offset().left,
                        y: ( - pos.y + 1) * canvas.height() / 2 + canvas.offset().top };
            }

            function onMouseOverScene (evt) {
                var object = evt.object,
                    point = evt.point;

                if (firebaseView.isLastModifier()) {
                    $scope.style.display = "none";

                    if (!object) {
                        $scope.style.point = false;
                        $scope.objectId = false;
                    }
                    else {
                        $scope.style.point = point;
                        $scope.style.stroke = getOppositeColorOfMesh(object);
                        $scope.objectId = object.atlasStructure && object.atlasStructure['@id'];
                    }
                    debouncedCommit();

                    mainApp.emit('distantMouseOverObject', false);
                }
            }

            function displayCrosshair () {
                if ($scope.style.point) {
                    $scope.style.display = "block";
                    var p = $scope.style.point,
                        point = new THREE.Vector3(p.x, p.y, p.z),
                        screenPos = toScreenXY(point);
                    $scope.style.top = screenPos.y-10;
                    $scope.style.left = screenPos.x-10;
                }
                else{
                    $scope.style.display = "none";
                }

                //display breadcrumbs
                mainApp.emit('distantMouseOverObject', $scope.objectId);

                $scope.safeApply();
            }

            mainApp.on('mouseOverScene', onMouseOverScene);

            firebaseView.bind($scope.style, ['stroke', 'point'], 'sceneCrosshair');
            firebaseView.bind($scope, 'objectId', 'sceneCrosshair');
            mainApp.on('firebaseView.viewChanged', displayCrosshair);


        }]
    };
}]);
