import teamcity from 'teamcity-rest-api'
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

module.exports = (pluginContext) => {
    const {shell,logger,preferences,app} = pluginContext;

    var teamcityClient = undefined;
    var loginStatus = 'no-prefs';

    const initClient = prefs=> {

        if (prefs.username && prefs.password && prefs.teamcityBaseUrl){
            teamcityClient= teamcity.create({
                url: prefs.teamcityBaseUrl,
                username: prefs.username,
                password: prefs.password
            });
            loginStatus = 'ok';
        }
    };

    const showLoginMessage = res =>{
        res.add({
            id: "message",
            title: "Please enter Username and Password",
            desc: "Click this to open preferences",
            icon :"#fa fa-unlock-alt",
            payload:{
                action:'prefs'
            }
        });
    };

    const showFailedLoginMessage = res =>{
        res.add({
            id: "message",
            title: "Oops, could'nt get your results",
            desc: "Make sure plugin preferences are correct, Click here to check",
            icon: "#fa fa-exclamation-circle",
            payload: {action: 'prefs'}
        });
    };

    const showLoader = res =>{
        res.add({
            id: 'message',
            title: "Loading...",
            desc: "Results are on their way.",
            icon :"#fa fa fa-spinner fa-spin fa-3x fa-fw"
        });
    };

    const hideMessage = res=> res.remove('message');

    const searchProjects = (res,query_trim)=>{

        teamcityClient.getProjects()
            .then(projects=> {
                return Object.keys(projects).map(x=> projects[x]).filter(x=> x.name.toLowerCase().indexOf(query_trim.toLowerCase()) > -1)
            })
            .then(projects=>{
                loginStatus = 'ok';
                hideMessage(res);
                projects.forEach(project=>{
                    res.add({
                        id: project.id,
                        title: project.name,
                        desc: project.description || '',
                        payload: {
                            action :'open',
                            id: project.id
                        }
                    })
                })
            })
            .catch(err=>{
                hideMessage(res);
                if (err.message && err.message.includes('401')) {
                    showFailedLoginMessage(res);
                    loginStatus = 'bad-creds';
                }
            });
    };

    const debouncedSearchProjects = debounce(searchProjects,200/);

    const startup = ()=>{
        initClient(preferences.get());
        preferences.on('update',initClient);
    };
    const search =(query, res)=> {
        const query_trim = query.trim();
        if (query_trim.length === 0) return;

        if (loginStatus === 'bad-creds'){
            showFailedLoginMessage(res);
            return;
        }
        if (loginStatus === 'no-prefs') {
            showLoginMessage(res);
            return;
        }

        hideMessage(res);
        showLoader(res);

        debouncedSearchProjects(res,query_trim);


    };

    const execute = (id, payload) =>{
        if (!payload) return;
        switch (payload.action){
            case 'prefs':{
                app.openPreferences('hain-plugin-teamcity');
                break;
            }
            case 'open':{
                if (!payload || !payload.id) return;
                const url = `${preferences.get().teamcityBaseUrl}/project.html?projectId=${payload.id}`
                shell.openExternal(url);
                app.close();
                break;
            }

        }
    };

    return { startup,search, execute }
};
