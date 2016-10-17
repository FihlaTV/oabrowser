const angular = require('angular');

angular.module('atlasDemo').provider('volumesManager', ['mainAppProvider', function (mainAppProvider) {

    var mainApp = mainAppProvider.$get(),
        volumes = [],
        backgrounds = [],
        slices = [],
        scene,
        cubeHelper = null,
        compositingSlices = {
            coronal : null,
            sagittal : null,
            axial : null
        },
        firebaseView,
        singleton = {
            slicesLinked : true
        };

    function setScene (s) {
        if (!scene) {
            scene = s;
        }
        else {
            throw 'Scene already set in volumesManager';
        }
    }

    function setupCubeHelper (volume) {
        if (mainApp.globalParameters.cubeHelper && !cubeHelper) {
            //box helper to see the extend of the volume
            var geometry = new THREE.BoxGeometry( volume.xLength, volume.yLength, volume.zLength );
            var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
            var cube = new THREE.Mesh( geometry, material );
            cube.visible = false;
            var box = new THREE.BoxHelper( cube );
            scene.add( box );
            box.applyMatrix(volume.matrix);
            scene.add( cube );
            cubeHelper = box;
            var gui = mainApp.gui;
            box.visible = false;
            gui.add(box, 'visible').name('Cube Helper');
        }
    }

    function buildColorTable (datasource, volume) {

        function findSelector (struc) {
            if (Array.isArray(struc.sourceSelector)) {
                return struc.sourceSelector.find(selector => selector.dataSource === datasource);
            }
            else {
                return struc.sourceSelector;
            }
        }

        var colorTable = {},
            structure,
            selector,
            structures = mainApp.atlasStructure.Structure,
            length = structures.length,
            i,
            reverseMapping = {};

        for (i = 0; i < length; i++) {
            structure = structures[i];
            selector = findSelector(structure);
            if (selector) {
                colorTable[selector.dataKey] = structure.renderOption.color;
                reverseMapping[selector.dataKey] = structure;
            }
        }

        volume.colorMap = colorTable;
        volume.reverseMapping = reverseMapping;
        return colorTable;
    }

    function addToCompositingSlices (sliceSet, treatAsBackground) {
        var opacity;
        if (!compositingSlices.axial) {

            compositingSlices.axial = new THREE.MultiVolumesSlice();
            mainApp.emit('insertSlice', {sliceId : 'axial', slice :  compositingSlices.axial});
            scene.add(compositingSlices.axial.mesh);

            compositingSlices.sagittal = new THREE.MultiVolumesSlice();
            mainApp.emit('insertSlice', {sliceId : 'sagittal', slice : compositingSlices.sagittal});
            scene.add(compositingSlices.sagittal.mesh);

            compositingSlices.coronal = new THREE.MultiVolumesSlice();
            mainApp.emit('insertSlice', {sliceId : 'coronal', slice : compositingSlices.coronal});
            scene.add(compositingSlices.coronal.mesh);


            opacity = treatAsBackground ? 1 : 0.5;
            compositingSlices.sagittal.addSlice(sliceSet.x, opacity, treatAsBackground);
            compositingSlices.coronal.addSlice(sliceSet.y, opacity, treatAsBackground);
            compositingSlices.axial.addSlice(sliceSet.z, opacity, treatAsBackground);

            var gui = mainApp.gui;
            var volume = sliceSet.x.volume;
            gui.add( compositingSlices.sagittal, "index", 0, volume.RASDimensions[0], 1 )
                .name( "index Sagittal" )
                .listen()
                .onChange( function () {compositingSlices.sagittal.repaint(true);} );
            gui.add( compositingSlices.coronal, "index", 0, volume.RASDimensions[1], 1 )
                .name( "index Coronal" )
                .listen()
                .onChange( function () {compositingSlices.coronal.repaint(true);} );
            gui.add( compositingSlices.axial, "index", 0, volume.RASDimensions[2], 1 )
                .name( "index Axial" )
                .listen()
                .onChange( function () {compositingSlices.axial.repaint(true);} );

            if (firebaseView) {
                setFirebaseSlicesBinding();
            }

        }
        //only the first background has a full opacity, the others start with an opacity of 0
        opacity = treatAsBackground ? 1 : 0.5;
        compositingSlices.sagittal.addSlice(sliceSet.x, opacity, treatAsBackground);
        compositingSlices.coronal.addSlice(sliceSet.y, opacity, treatAsBackground);
        compositingSlices.axial.addSlice(sliceSet.z, opacity, treatAsBackground);

        if (treatAsBackground && backgrounds.length>1) {
            compositingSlices.axial.setVisibility(sliceSet.z, false);
            compositingSlices.coronal.setVisibility(sliceSet.y, false);
            compositingSlices.sagittal.setVisibility(sliceSet.x, false);
        }

        repaintCompositingSlices(true);
    }

    function addVolume (volume, datasource, treatAsBackground) {

        var sliceX,
            sliceY,
            sliceZ;

        treatAsBackground = treatAsBackground === undefined ? isBackground(datasource) : treatAsBackground;

        setupCubeHelper(volume);

        if (treatAsBackground) {
            backgrounds.push(volume);
            volume.dataType = 'background';
        }
        else {
            buildColorTable(datasource, volume);
            volume.dataType = 'label';
        }

        volumes.push(volume);

        datasource.volume = volume;
        volume.datasource = datasource;

        //z plane

        sliceZ = volume.extractSlice('z',Math.floor(volume.RASDimensions[2]/2));

        //y plane
        sliceY = volume.extractSlice('y',Math.floor(volume.RASDimensions[1]/2));

        //x plane
        sliceX = volume.extractSlice('x',Math.floor(volume.RASDimensions[0]/2));

        var sliceSet = {x : sliceX, y : sliceY, z : sliceZ};
        addToCompositingSlices(sliceSet, treatAsBackground);

        slices.push(sliceSet);

        setFirebaseVolumeBinding(volume);

        mainApp.emit('volumesManager.volumeAdded');


    }

    function isBackground (datasource) {
        var backgroundImages = mainApp.atlasStructure.Header.backgroundImage;
        return backgroundImages === datasource || backgroundImages.includes(datasource);
    }

    function toggleVisibilityInCompositing (volume, slice) {
        var background = backgrounds.includes(volume),
            index = volumes.indexOf(volume),
            visible = slice.getVisibility(volume),
            i;

        if (singleton.slicesLinked) {
            if (background) {
                for (i = 0; i < backgrounds.length; i++) {
                    compositingSlices.axial.setVisibility(backgrounds[i], false);
                    compositingSlices.coronal.setVisibility(backgrounds[i], false);
                    compositingSlices.sagittal.setVisibility(backgrounds[i], false);
                }
            }
            compositingSlices.axial.setVisibility(slices[index].z, !visible);
            compositingSlices.coronal.setVisibility(slices[index].y, !visible);
            compositingSlices.sagittal.setVisibility(slices[index].x, !visible);
            repaintCompositingSlices(true);
        }
        else {
            if (background) {
                for (i = 0; i < backgrounds.length; i++) {
                    slice.setVisibility(backgrounds[i], false);
                }
            }
            slice.setVisibility(slices[index][slice.axis], !visible);
            slice.repaint(true);
        }
    }

    function isVolumeABackground (volume) {
        return backgrounds.includes(volume);
    }


    function repaintCompositingSlices (all) {
        compositingSlices.axial.repaint(all);
        compositingSlices.coronal.repaint(all);
        compositingSlices.sagittal.repaint(all);
    }

    function setCompositingSlicesVisibility (value) {
        compositingSlices.axial.mesh.visible = value;
        compositingSlices.coronal.mesh.visible = value;
        compositingSlices.sagittal.mesh.visible = value;
    }

    function getStructuresAtRASPosition (point) {
        var result = [],
            volume,
            pos,
            label,
            structure,
            i;
        for (i = 0; i < volumes.length; i++) {
            volume = volumes[i];
            if (volume.dataType === 'label') {
                pos = point.clone();
                pos.applyMatrix4(volume.inverseMatrix);
                pos.x += volume.dimensions[0]/2;
                pos.y += volume.dimensions[1]/2;
                pos.z += volume.dimensions[2]/2;
                pos.floor();
                label = volume.getData(pos.x, pos.y, pos.z);
                if (label) {
                    structure = volume.reverseMapping[label];
                    if (structure) {
                        result.push(structure);
                    }
                }
            }
        }
        return result;
    }


    function setVolumeOpacityInCompositingSlices (volume, value) {
        compositingSlices.axial.setOpacity(volume,value);
        compositingSlices.coronal.setOpacity(volume,value);
        compositingSlices.sagittal.setOpacity(volume,value);
    }

    function setFirebaseView (fv) {
        if (!firebaseView) {
            firebaseView = fv;
            if (compositingSlices.axial) {
                setFirebaseSlicesBinding();
            }
        }
    }

    function setFirebaseSlicesBinding () {
        firebaseView.bind(compositingSlices.axial, ['index', 'opacities', 'visibilities'], 'axial.slice');
        firebaseView.bind(compositingSlices.coronal, ['index', 'opacities', 'visibilities'], 'coronal.slice');
        firebaseView.bind(compositingSlices.sagittal, ['index', 'opacities', 'visibilities'], 'sagittal.slice');
        mainApp.on('firebaseView.viewChanged', function () {
            setTimeout(function () {
                repaintCompositingSlices(true);
            }, 5);
        });
    }

    function setFirebaseVolumeBinding (volume) {
        var nameRegexp = /([0-9a-zA-Z_\-]+)\.\w+$/;
        var name = volume.datasource.source.match(nameRegexp)[1];
        firebaseView.bind(volume, ['lowerThreshold', 'upperThreshold', 'windowLow', 'windowHigh'], 'volumes.'+name);

    }


    singleton.volumes = volumes;
    singleton.setScene = setScene;
    singleton.addVolume = addVolume;
    singleton.toggleVisibility = toggleVisibilityInCompositing;
    singleton.compositingSlices = compositingSlices;
    singleton.isVolumeABackground = isVolumeABackground;
    singleton.isBackground = isBackground;
    singleton.repaintCompositingSlices = repaintCompositingSlices;
    singleton.setCompositingSlicesVisibility = setCompositingSlicesVisibility;
    singleton.getStructuresAtRASPosition = getStructuresAtRASPosition;
    singleton.setVolumeOpacityInCompositingSlices = setVolumeOpacityInCompositingSlices;
    singleton.setFirebaseView = setFirebaseView;

    //methods accessible from outside by injecting volumesManager
    this.$get = function () {
        return singleton;
    };
}]);
