/**
 * This class has been made to merge several slices
 * @class
 * @see THREE.MultiVolumesSlice
 */

THREE.MultiVolumesSlice = function( ) {

    var self = this;
    function definePropertyAsFirstSlice (name) {
        Object.defineProperty( self, name, {
            get : function() {
                if (self.slices.length > 0) {
                    return this.slices[0][name];
                }
                return undefined;

            },
            set : function() {

            }
        } );
    }


    /**
     * @member {Array} slices Hold all the slices to merge
     */
    this.slices = [];

    /**
     * @member {Array} opacities Hold all the corresponding opacities
     */
    this.opacities = [];

    /**
     * @member {Array} visibilities Hold all the corresponding visibilities
     */
    this.visibilities = [];

    /**
     * @member {Array} volumes Read only : Hold all the volumes associated to the slices
     */
    Object.defineProperty( this, 'volumes', {
        get : function() {
            return this.slices.map(slice => slice.volume);
        },
        set : function() {}
    } );

    /**
     * @member {Number} index index of all the slice (should be consistent)
     */
    Object.defineProperty( this, 'index', {
        get : function() {

            if (this.slices.length > 0) {
                return this.slices[0].index;
            }
            return undefined;

        },
        set : function( value ) {

            value = Number(value);
            if (!isNaN(value)) {
                this.slices.forEach(slice => slice.index = value);
                this.geometryNeedsUpdate = true;
            }
            return value;

        }
    } );
    /**
	 * @member {String} axis The normal axis
     */
    definePropertyAsFirstSlice('axis');


    /**
     * @member {Object} listeners store all the listeners to the events of this slice
     */
    this.listeners = {
        repaint : [],
        addSlice : [],
        removeSlice : [],
        updateGeometry : []
    };

    /**
	 * @member {HTMLCanvasElement} canvas The final canvas used for the texture
	 */
    /**
	 * @member {CanvasRenderingContext2D} ctx Context of the canvas
	 */
    this.canvas = document.createElement( 'canvas' );

    this.alphaCanvas = document.createElement( 'canvas' );


    var canvasMap = new THREE.Texture( this.canvas );
    canvasMap.minFilter = THREE.LinearFilter;
    canvasMap.wrapS = canvasMap.wrapT = THREE.ClampToEdgeWrapping;

    var alphaCanvasMap = new THREE.Texture( this.alphaCanvas );
    alphaCanvasMap.minFilter = THREE.LinearFilter;
    alphaCanvasMap.wrapS = alphaCanvasMap.wrapT = THREE.ClampToEdgeWrapping;

    var material = new THREE.MeshBasicMaterial( { map: canvasMap, alphaMap: alphaCanvasMap, side: THREE.DoubleSide, transparent : true, alphaTest : 0.01 } );
    /**
     * @member {THREE.Mesh} mesh The mesh ready to get used in the scene
     */
    this.mesh = new THREE.Mesh( this.geometry, material );
    this.mesh.renderOrder = 0;
    /**
     * @member {Boolean} geometryNeedsUpdate If set to true, updateGeometry will be triggered at the next repaint
     */
    this.geometryNeedsUpdate = true;

    /**
     * @member {Number} iLength Width of slice in the original coordinate system, corresponds to the width of the buffer canvas
     */
    definePropertyAsFirstSlice('iLength');

    /**
     * @member {Number} jLength Height of slice in the original coordinate system, corresponds to the height of the buffer canvas
     */

    definePropertyAsFirstSlice('jLength');

    definePropertyAsFirstSlice('matrix');
    definePropertyAsFirstSlice('maxIndex');



};

THREE.MultiVolumesSlice.prototype = {

    constructor : THREE.MultiVolumesSlice,

    /**
     * @member {Function} repaint Refresh the texture and the geometry if geometryNeedsUpdate is set to true
     * @param {Boolean} repaintAll Introduced to avoid unnecesary redraw of every sub slice. If not specified, sub slices will not be repainted.
     * @memberof THREE.MultiVolumesSlice
     */
    repaint : function(repaintAll) {

        repaintAll = repaintAll || false;
        if (repaintAll) {
            var multiSlice = this;
            this.slices.forEach(function (slice,i) {
                if (multiSlice.visibilities[i]) {
                    slice.repaint();
                }
            });
        }

        if ( this.geometryNeedsUpdate ) {

            this.slices[0].geometryNeedsUpdate = true;
            this.slices[0].repaint();
            this.updateGeometry();

        }

        var i,
            slice,
            ctx = this.ctx;

        //clean canvas before doing anything
        ctx.clearRect(0,0, this.canvas.width, this.canvas.height);

        for (i = 0; i < this.slices.length; i++) {
            slice = this.slices[i];
            if (this.visibilities[i] && this.opacities[i]>0) {
                ctx.globalAlpha = this.opacities[i];
                ctx.drawImage(slice.canvas,0,0);
            }

        }
        var imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
        var alphaCtx = this.alphaCanvas.getContext('2d');
        var alphaImageData = alphaCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        var alphaData = alphaImageData.data;
        for (i = 0; i < alphaData.length; ) {
            alphaData[i] = imageData[i+3];
            alphaData[i+1] = imageData[i+3];
            alphaData[i+2] = imageData[i+3];
            alphaData[i+3] = imageData[i+3];
            i = i + 4;
        }
        alphaCtx.putImageData(alphaImageData, 0, 0);

        this.mesh.material.alphaMap.needsUpdate = true;
        this.mesh.material.map.needsUpdate = true;

        this.listeners.repaint.map( listener => listener.callback.call(listener.context));

    },

    /**
     * @member {Function} updateGeometry Refresh the geometry according to axis and index
     * @see THREE.Volume.extractPerpendicularPlane
     * @memberof THREE.MultiVolumesSlice
     */
    updateGeometry : function() {

        if (this.slices.length > 0) {

            var mainSlice = this.slices[0];

            this.canvas.width = mainSlice.canvas.width;
            this.canvas.height = mainSlice.canvas.height;
            this.ctx = this.canvas.getContext( '2d' );

            this.alphaCanvas.width = mainSlice.canvas.width;
            this.alphaCanvas.height = mainSlice.canvas.height;

            this.geometry = mainSlice.geometry;

            if ( this.mesh ) {

                this.mesh.geometry = this.geometry;
                //reset mesh matrix
                this.mesh.matrix = ( new THREE.Matrix4() ).identity();
                this.mesh.applyMatrix( this.matrix );

            }

            this.geometryNeedsUpdate = false;
            this.listeners.updateGeometry.map( listener => listener.callback.call(listener.context));
        }

    },

    /**
     * @member {Function} onRepaint add a listener to the list of listeners
     * @param {Object} context
     * @param {Function} listener
     * @memberof THREE.MultiVolumesSlice
     */
    onRepaint : function (context, callback) {

        this.listeners.repaint.push({callback : callback, context : context});

    },

    /**
     * @member {Function} onAddSlice add a listener to the list of listeners
     * @param {Object} context
     * @param {Function} listener
     * @memberof THREE.MultiVolumesSlice
     */
    onAddSlice : function (context, callback) {

        this.listeners.addSlice.push({callback : callback, context : context});

    },

    /**
     * @member {Function} onRemoveSlice add a listener to the list of listeners
     * @param {Object} context
     * @param {Function} listener
     * @memberof THREE.MultiVolumesSlice
     */
    onRemoveSlice : function (context, callback) {

        this.listeners.removeSlice.push({callback : callback, context : context});

    },


    /**
     * @member {Function} onUpdateGeometry add a listener to the list of listeners
     * @param {Object} context
     * @param {Function} listener
     * @memberof THREE.MultiVolumesSlice
     */
    onUpdateGeometry : function (context, callback) {

        this.listeners.updateGeometry.push({callback : callback, context : context});

    },

    /**
     * @member {Function} addSlice add a slice to the list of slices to merge
     * @param {THREE.VolumeSlice} slice           The slice to add
     * @param {Number}            opacity         The opacity associated to this layer. Default is 1.
     * @param {Boolean} insertInBackground If true the slice will be the new background
     * @memberof THREE.MultiVolumesSlice
     */
    addSlice : function (slice, opacity, insertInBackground) {

        if (!this.slices.includes(slice)) {
            opacity = opacity === undefined ? 1 : opacity;
            insertInBackground = insertInBackground || false;

            if (insertInBackground) {
                this.slices.unshift(slice);
                this.opacities.unshift(opacity);
                this.visibilities.unshift(true);
            }
            else {
                this.slices.push(slice);
                this.opacities.push(opacity);
                this.visibilities.push(true);
            }

            this.listeners.addSlice.map( listener => listener.callback.call(listener.context, slice));
        }
    },

    /**
     * @member {Function} removeSlice remove a slice from the list of slices to merge
     * @param {THREE.VolumeSlice} slice           The slice to remove
     * @memberof THREE.MultiVolumesSlice
     */
    removeSlice : function (slice) {

        var index = this.slices.indexOf(slice);
        if (index > -1) {
            this.slices.splice(index,1);
            this.opacities.splice(index,1);

            this.listeners.removeSlice.map( listener => listener.callback.call(listener.context, slice));
        }

    },

    /**
     * @member {Function} setOpacity change the opacity of the given slice
     * @param {THREE.VolumeSlice} slice   The slice or volume whose opacity will be changed
     * @param {Number} opacity  new value
     * @memberof THREE.MultiVolumesSlice
     */
    setOpacity : function (slice, opacity) {

        var index;
        if (slice instanceof THREE.VolumeSlice) {
            index = this.slices.indexOf(slice);
            if (index > -1) {
                this.opacities[index] = opacity;
            }
        }
        else if (slice instanceof THREE.Volume) {
            index = this.volumes.indexOf(slice);
            if (index > -1) {
                this.opacities[index] = opacity;
            }
        }

    },

    /**
     * @member {Function} getOpacity get the opacity of the given slice
     * @param {THREE.VolumeSlice} slice   The slice or volume
     * @memberof THREE.MultiVolumesSlice
     * @returns {Number} the opacity
     */
    getOpacity : function (slice) {
        var index;
        if (slice instanceof THREE.VolumeSlice) {
            index = this.slices.indexOf(slice);
            if (index > -1) {
                return this.opacities[index];
            }
        }
        else if (slice instanceof THREE.Volume) {
            index = this.volumes.indexOf(slice);
            if (index > -1) {
                return this.opacities[index];
            }
        }
        return undefined;

    },

    /**
     * @member {Function} setVisibility change the visibility of the given slice or volume
     * @param {THREE.VolumeSlice} slice   The slice or volume whose visibility will be changed
     * @param {Number} visibility  new value
     * @memberof THREE.MultiVolumesSlice
     */
    setVisibility : function (slice, visibility) {

        var index;
        if (slice instanceof THREE.VolumeSlice) {
            index = this.slices.indexOf(slice);
            if (index > -1) {
                this.visibilities[index] = visibility;
            }
        }
        else if (slice instanceof THREE.Volume) {
            index = this.volumes.indexOf(slice);
            if (index > -1) {
                this.visibilities[index] = visibility;
            }
        }

    },

    /**
     * @member {Function} getVisibility get the visibility of the given slice or volume
     * @param {THREE.VolumeSlice} slice   The slice or volume
     * @memberof THREE.MultiVolumesSlice
     * @returns {Number} the visibility
     */
    getVisibility : function (slice) {
        var index;
        if (slice instanceof THREE.VolumeSlice) {
            index = this.slices.indexOf(slice);
            if (index > -1) {
                return this.visibilities[index];
            }
        }
        else if (slice instanceof THREE.Volume) {
            index = this.volumes.indexOf(slice);
            if (index > -1) {
                return this.visibilities[index];
            }
        }
        return undefined;

    },

    /**
     * @member {Function} getBackground get the background of this multislice
     * @memberof THREE.MultiVolumesSlice
     * @returns {THREE.Volume} the background or null if none is found
     */
    getBackground : function () {
        var volumes = this.volumes;
        for (var i = 0; i<volumes.length; i++) {
            var background = volumes[i];
            if (background.dataType === 'background' && this.getOpacity(background)>0) {
                return background;
            }
        }
        return null;
    },

    /**
     * @member {Function} getStructuresAtPosition Returns a list of structures from the labels map stacked at this position
     * @param {Number} x
     * @param {Number} y
     * @memberof THREE.MultiVolumesSlice
     * @returns {Array} the structures (can contain undefined)
     */
    getStructuresAtPosition : function (x,y) {
        //get only the label map
        var labelSlices = this.slices.filter(slice => slice.volume.dataType === 'label');
        //return the structures
        return labelSlices.map(slice => {
            var i = Math.round(x*slice.canvasBuffer.width/slice.canvas.width);
            var j = Math.round(y*slice.canvasBuffer.height/slice.canvas.height);
            if (i>= slice.iLength || i<0 || j>= slice.jLength || j<0) {
                return undefined;
            }
            return slice.volume.reverseMapping[slice.volume.data[slice.sliceAccess(i,j)]];
        });
    }

};
