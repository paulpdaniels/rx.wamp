module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat : {
            options : {
            },
            dist : {
                src : ['src/intro.js', 'src/header.js', 'src/version.js', 'src/connection.js', 'src/session.js', 'src/pubsubsubject.js', 'src/outro.js'],
                dest : 'dist/rx.wamp.js'
            }
        },
        uglify : {
            options : {
                mangle : {
                    except : ['autobahn', 'rx']
                },
                sourceMap : true,
                sourceMapName : 'dist/rx.wamp.map'
            },
            distFiles : {
                files : {
                    'dist/rx.wamp.min.js' : ['dist/rx.wamp.js']
                }
            }
        }
    });

    // Load the plugin that provides the "uglify" task.
//    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    // Default task(s).
    grunt.registerTask('default', ['concat', 'uglify']);

};