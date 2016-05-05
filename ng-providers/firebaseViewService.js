var FirebaseView = (function () {
    var singleton = {},
        $root,
        $location,
        $firebaseObject,
        $firebaseAuth,
        unwatch,
        pathRegExp = /view\/([\w-]+)/,
        uuid,
        dbRootObj,
        mainApp,
        $body,
        unbindFunctions = [],
        bindObjects = [],
        onValueListeners = [],
        commitListeners = [],
        mouseUpTimeoutId,
        wheelTimeoutId,
        loadingNewView = true,
        loadingManager,
        initiated = false;

    singleton.setRootScope = function (root) {
        if (!$root) {
            $root = root;
        }
        init();
    };

    singleton.setLocation = function (location) {
        if (!$location) {
            $location = location;
        }
        init();
    };

    singleton.setFirebase = function (firebaseObject, firebaseAuth) {
        if (!$firebaseAuth && !$firebaseObject) {
            $firebaseObject = firebaseObject;
            $firebaseAuth = firebaseAuth;
        }
        init();

    };

    singleton.setMainApp = function (mA) {
        if (!mainApp) {
            mainApp = mA;
        }
    };

    singleton.setLoadingManager = function (lm) {
        if (!loadingManager) {
            loadingManager = lm;
        }
    };

    function setWatcher () {
        if ($root && $location && !unwatch) {
            unwatch = $root.$watch(function () { return $location.path();}, function (newValue) {
                var newPath = parsePath(newValue);
                if (newPath !== uuid) {
                    uuid = newPath;
                    loadDatabaseConnection();
                }
            });
        }
    }

    function parsePath (path) {
        var match = path.match(pathRegExp);
        if (match) {
            return match[1];
        }
        return '';
    }

    function generateUUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c==='x' ? r : (r&0x3|0x8)).toString(16);
        });
        return uuid;
    }

    function setNewPath () {
        if ($location) {
            uuid = generateUUID();
            $location.path('view/'+uuid);
            loadDatabaseConnection();
        }
    }

    function init () {
        //init () can only be run once
        if (initiated) {
            return;
        }
        setWatcher();
        if ($location && $firebaseObject) {
            var initialPath = parsePath($location.path());
            if (initialPath.length === 0) {
                setNewPath();
            }
            else {
                uuid = initialPath;
                loadDatabaseConnection();
            }
            initiated = true;
        }
    }

    function authAnonymously (ref) {
        if (!singleton.auth) {
            ref.authAnonymously(function(error, authData) {
                if (error) {
                    console.log("Authentication Failed!", error);
                } else {
                    console.log("Authenticated successfully with payload:", authData);
                    singleton.auth = authData;
                    loadViewerConnection();
                }
            });
        }
        else {
            loadViewerConnection();
        }
    }

    function authHandler (authData) {
        if (authData) {
            singleton.auth = authData;
        }
        else {
            //get to this part when user log out
            singleton.auth = null;
            authAnonymously(singleton.ref);
        }
    }

    function loadViewerConnection () {
        var ref = new Firebase("https://atlas-viewer.firebaseio.com/views/"+uuid+"/viewers/"+singleton.auth.uid);

        var int = setInterval(function () {
            ref.child('lastUpdate').set(Date.now());
        }, 30000);

        ref.on('value', function(snapshot) {
            //reload the connection if one of the author give him the edition rights
            var val = snapshot.val();
            if (val && val.author) {
                loadDatabaseConnection();
            }
        });

        function unbind () {
            clearInterval(int);
        }
        $(window).unload(function () {
            ref.remove();
        });
        unbindFunctions.push(unbind);
    }

    function loadDatabaseConnection () {

        var ref = new Firebase("https://atlas-viewer.firebaseio.com/views/"+uuid);
        if (dbRootObj) {
            dbRootObj.$destroy();
            unbindAll();
        }
        loadingNewView = true;
        dbRootObj = $firebaseObject(ref);
        // this waits for the data to load and then logs the output.
        dbRootObj.$loaded()
            .then(function() {
            console.log(dbRootObj);
        })
            .catch(function(err) {
            console.error(err);
        });
        singleton.obj = dbRootObj;
        singleton.ref = ref;

        function onValueFireEvent () {
            requestAnimationFrame(function () {
                mainApp.emit('firebaseView.viewChanged');
            });
        }
        onValueListeners.push(onValueFireEvent);
        ref.on('value', onValue);

        singleton.auth = ref.getAuth();
        authAnonymously(ref);


        ref.onAuth(authHandler);


        function commiter () {
            dbRootObj.lastModifiedBy = singleton.auth.uid;

            //add himself to the list of authors
            if (!dbRootObj.authors || !dbRootObj.authors[singleton.auth.uid]) {
                dbRootObj.authors = dbRootObj.authors || {};
                dbRootObj.authors[singleton.auth.uid] = true;
            }
        }
        commitListeners.push(commiter);

        $body = $(document.body);
        $body.on('mouseup', onMouseUp);
        $body.on('mousewheel', onMouseWheel);

        function unbind () {
            ref.off();
            ref.offAuth(authHandler);
            $body.off('mouseup', onMouseUp);
            $body.off('mousewheel', onMouseWheel);
        }

        unbindFunctions.push(unbind);

    }

    function commit () {
        if (!dbRootObj.locked) {
            if (!loadingManager.isLoading()){
                commitListeners.map(fn => fn());
                dbRootObj.$save();
            }
        }
    }

    function onMouseUp () {
        clearTimeout(mouseUpTimeoutId);
        mouseUpTimeoutId = setTimeout(commit,30);
    }

    function onMouseWheel () {
        clearTimeout(wheelTimeoutId);
        wheelTimeoutId = setTimeout(commit,1000);
    }

    function onValue (snapshot) {
        var snapshotValue = snapshot.val();
        if (snapshotValue) {
            if (loadingManager.isLoading()) {
                mainApp.on('loadingManager.loadingEnd', function () {
                    requestAnimationFrame(function () {
                        onValueListeners.map(fn => fn(snapshotValue));
                    });
                });
            }
            else if (singleton.auth.uid !== snapshotValue.lastModifiedBy || loadingNewView) {
                onValueListeners.map(fn => fn(snapshotValue));
            }
            loadingNewView = false;
        }
    }

    function getDbObj (pathArray, snapshotValue) {
        //retrieve the right db object from the path array
        // the reference can't be stored in memory because dbRootObj replaces its children by copies from the db
        var obj = snapshotValue || dbRootObj;
        for (var i = 0; i < pathArray.length; i++) {
            if (!obj[pathArray[i]]) {
                obj[pathArray[i]] = {};
            }
            obj = obj[pathArray[i]];
        }
        return obj;
    }

    singleton.customBind = function (watchCallback, dbChangeCallback, pathArray) {
        function onValueListener (snapshotValue) {
            if (snapshotValue) {
                var dbObj = getDbObj(pathArray, snapshotValue);
                if (dbObj) {
                    dbChangeCallback(dbObj);
                }
            }
        }
        onValueListeners.push(onValueListener);
        function commiter () {
            var dbObj = getDbObj(pathArray);
            var modified = watchCallback(dbObj);
            modified = modified === undefined ? true : modified;
            return modified;
        }
        commitListeners.push(commiter);

    };

    function unbindAll () {
        unbindFunctions.map(unbind => unbind());
        unbindFunctions = [];
    }

    function createBinding (obj, key, pathArray) {
        if (typeof key === 'string') {
            key = [key];
        }
        function onValueListener (dbObj) {
            if (typeof dbObj === 'object' && dbObj !== null) {
                for (var i = 0 ; i<key.length;i++) {
                    obj[key[i]] = dbObj[key[i]];
                }
            }
        }

        function commiter (dbObj) {
            var v,
                k,
                modified = false;
            for (var i = 0 ; i<key.length;i++) {
                k = key[i];
                v = obj[k];
                if (dbObj[k] !== obj[k]) {
                    //prevent values to be undefined because firebase does not handle undefined value
                    dbObj[k] = v === undefined ? false : v;
                    modified = true;
                }
            }
            return modified;
        }

        singleton.customBind(commiter, onValueListener, pathArray);

    }

    singleton.bind = function (obj, key, path) {
        var pathArray = path !== '' ? path.split('.') : [];

        createBinding(obj, key, pathArray);

        var bindObject = {
            obj : obj,
            key : key,
            pathArray : pathArray
        };

        bindObjects.push(bindObject);

    };

    function recreateAllBindings () {
        bindObjects.map(bindObject => createBinding(bindObject.obj, bindObject.key, bindObject.pathArray));
    }

    singleton.lockView = function () {
        dbRootObj.locked = true;
        dbRootObj.$save();
    };

    singleton.unlockView = function () {
        dbRootObj.locked = false;
        //commit changes which happened during the period of lock
        commit();
        dbRootObj.$save();
    };

    singleton.isLocked = function () {
        return dbRootObj && !!dbRootObj.locked;
    };

    singleton.isAuthor = function () {
        return dbRootObj && dbRootObj.camera;
    };

    singleton.getOtherViewersId = function () {
        if (dbRootObj && dbRootObj.viewers) {
            var list = Object.keys(dbRootObj.viewers);
            var index = list.indexOf(singleton.auth.uid);
            if (index > -1) {
                list.splice(index,1);
            }
            return list;
        }
        return [];
    };



    return function () {return singleton;};

})();

angular.module('atlasDemo').service('firebaseView',[ '$rootScope', '$location', '$firebaseObject', '$firebaseAuth', 'volumesManager', 'mainApp', 'loadingManager', function ($root, $location, $firebaseObject, $firebaseAuth, volumesManager, mainApp, loadingManager) {
    'use strict';
    var fv = FirebaseView();
    fv.setLoadingManager(loadingManager);
    fv.setLocation($location);
    fv.setRootScope($root);
    fv.setFirebase($firebaseObject, $firebaseAuth);
    fv.setMainApp(mainApp);
    volumesManager.setFirebaseView(fv);
    return fv;
}]);
