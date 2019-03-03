// jshint esversion: 8
(function(){
    'use strict';

    // Add log line.
    function addLogLine(line){
        document.getElementById('log').innerHTML = line + '<p>' + document.getElementById('log').innerHTML;
    }

    // add a roulette winning number to the history.
    function addResultToHistory(winning_number){
        const entry = document.createElement('li');
        entry.appendChild(document.createTextNode(winning_number));
        let list = document.getElementById("history-ul");
        list.insertBefore(entry, list.childNodes[0]);
    }

    // Get selected numbers from a mouse event on the layout.
    function getCoverage(mouseEvent){
        let cell = mouseEvent.target;
        if(!('bet' in cell.dataset && cell.dataset.bet)) return [];
        let selection = cell.dataset.bet.split(',').map(function(x){return parseInt(x, 10);});

        // Outer bets.
        if(selection.length > 1 || selection[0] === 0){
            return selection;
        }

        let rect = cell.getBoundingClientRect();
        let width = cell.offsetWidth;
        let height = cell.offsetHeight;
        let relativeX = (mouseEvent.clientX - rect.left) / width - 0.5;
        let relativeY = (mouseEvent.clientY - rect.top) / height - 0.5;
        if(relativeX > 0.3 && selection[0] % 3 !== 0){
            selection.push(selection[0] + 1);
        }else if(relativeX < -0.3 && selection[0] % 3 !== 1){
            selection.push(selection[0] - 1);
        }
        if(relativeY > 0.3 && selection[0] < 34){
            selection = selection.concat(selection.map(function(x){return x + 3;}));
        }else if(relativeY < -0.3 && selection[0] > 3){
            selection = selection.concat(selection.map(function(x){return x - 3;}));
        }
        return selection;
    }

    // Place a bet.
    async function processBet(coverage, larimers){
        if(36 % coverage.length !== 0){
            console.error('coverage size must divide 36');
            return false;
        }
        try{
            let hash = (await roulette.bet(
                rouletteClient.spin.hash, coverage, parseInt(larimers, 10), +new Date()
            )).processed.action_traces[0].act.data.hash;

            if(hash){
                if(hash.name && hash.name === 'TypeError'){
                    console.error(hash);
                    document.getElementById('message').innerText = 'Could not place bet - aborting...';
                }else{
                    rouletteClient.coverage = coverage;
                    addLogLine(roulette.account_name + ' placed ' + larimers + ' larimers on ' + coverage + ' to win');
                    console.log(hash + '->' + coverage);
                }
            }else{
                document.getElementById('message').innerText = 'Could not connect to roulette - retrying...';
                setTimeout(function(){processBet(mouseEvent, larimers);}, 1000);
            }
        }catch(e){
            console.error(e);
            return e;
        }
    }

    // Initialize an html element as a layout.
    // It is assumed that the element contains mouse sensitive elements with data-bet attributes.
    function initLayout(layout){

        // Highlight on mouse movement.
        layout.onmousemove = function(mouseEvent){
            document.querySelectorAll('[data-bet]').forEach(function(element){
                element.classList.remove('highlight');
            });
            getCoverage(mouseEvent).forEach(function(number){
                document.querySelectorAll('[data-bet="' + number + '"]')[0].classList.add('highlight');
            });
        };

        //remove all highlights when leaving the felt
        layout.onmouseleave = function(mouseEvent){
            document.querySelectorAll('[data-bet]').forEach(function(element){
                element.classList.remove('highlight');
            });
        };

        // Place a bet on mouse click.
        layout.onclick = function(mouseEvent){
            console.log(mouseEvent);
            processBet(getCoverage(mouseEvent), 5000);

            //playing with chips
            var chip = document.getElementById('chip1').cloneNode(true);
            chip.id = 'new';
            chip.style.left = (mouseEvent.clientX-2)+'px';
            chip.style.top = (mouseEvent.clientY-7)+'px';
            chip.style.backgroundColor = "#"+((1<<24)*Math.random()|0).toString(16);
            document.body.appendChild(chip);
        };
    }

    // Initialize roulette. Assumes user is logged in with scatter.
    function init(){

        // Initialize layout.
        initLayout(document.getElementById('layout'));

        // Balance updater.
        (async function updateBalance(){
            document.getElementById('balance').innerText = (await roulette.getBalance()).rows[0].balance;
            setTimeout(updateBalance, 1000);
        })();

        // Spin updater.
        (async function updateSpin(){
            let now = Math.round(new Date() / 1000);
            if(rouletteClient.spin){
                if(now < rouletteClient.spin.maxbettime){
                    document.getElementById('sec-left').innerText = rouletteClient.spin.maxbettime - now;
                }
            }else{
                rouletteClient.spin = await roulette.getSpin(now + 15);
                if(rouletteClient.spin){
                    addLogLine('got spin ' + rouletteClient.spin.hash);
                    roulette.poll(rouletteClient.spin, -1, function(result){
                        addLogLine('Roulette stops on ' + result.winning_number + '!');
                        addResultToHistory(result.winning_number);
                        if(rouletteClient.coverage.indexOf(result.winning_number) > -1){
                            let message = roulette.account_name + ' won ' + (
                                5000 * (36 / rouletteClient.coverage.length)
                            ) + ' larimers';
                            document.getElementById('message').innerText = message;
                            addLogLine(message);
                        }
                        rouletteClient.spin = false;
                        rouletteClient.coverage = [];
                    });
                }else{
                    console.error('no available spins');
                }
            }
            setTimeout(function(){updateSpin();}, 1000);
        })();
    }

    // Expose some functionality.
    window.rouletteClient = {
        spin: false,
        coverage: [],
        hintsShown: false,
        startIntro: function(){introJs().start();},
        toggleHints: function(){
            rouletteClient.hintsShown = !rouletteClient.hintsShown;
            introJs()[rouletteClient.hintsShown ? 'hideHints' : 'showHints']();
        },
        login: function(){
            roulette.login(function(account_name){
                if(account_name){
                    document.getElementById('user').innerText = account_name;
                    init();
                }
            });
        }
    };

    // FIXME Just for debug.
    window.onload = function(){
        initLayout(document.getElementById('layout'));
    }

}());
