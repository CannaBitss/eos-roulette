// jshint esversion: 8
let larimers = null;
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
        layout.addEventListener('mousemove', function(mouseEvent){
            document.querySelectorAll('[data-bet]').forEach(function(element){
                element.classList.remove('highlight');
            });
            getCoverage(mouseEvent).forEach(function(number){
                document.querySelectorAll('[data-bet="' + number + '"]')[0].classList.add('highlight');
            });
        });

        //remove all highlights when leaving the felt
        layout.addEventListener('mouseleave', function(mouseEvent){
            document.querySelectorAll('[data-bet]').forEach(function(element){
                element.classList.remove('highlight');
            });
        });

        // Place a bet on mouse click.
        layout.onclick = function(mouseEvent){
            console.log(mouseEvent);
            if (larimers) {
                processBet(getCoverage(mouseEvent), larimers);
            } else {
                addLogLine("choose token first")
            }

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
        selectToken: function(element, value){
            larimers = value * 10000;
            let selector = document.getElementById("chip-selector");
            selector.scrollTo({
                left: element.offsetLeft - element.parentElement.parentElement.clientWidth/ 2 + 14, top: 0,
                behavior: 'smooth'
            });
            // add iso to all
            selector.querySelectorAll(".chip").forEach(
                function (chip) { chip.classList.add("iso") }
            );
            // remove iso from chosen
            element.classList.remove("iso");
            let msg = "Each token now worth " + value + " EOS"
            addLogLine(msg);
            document.getElementById('message').innerText = msg;
        },
        toggleHints: function(){
            introJs()[rouletteClient.hintsShown ? 'hideHints' : 'showHints']();
            rouletteClient.hintsShown = !rouletteClient.hintsShown;
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

    const wheelOrder = [ 0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26 ]
    function spin(turns, win){

        const winSlotDeg = 360/37*wheelOrder.indexOf(win); // location of win number
        const shift =  0*Math.floor(Math.random() * 360); // random shift of wheel
        const wheelTrunDur = 1.5; // seconds per turn
        turns = 2;
        console.log("Land on " + win);
        const wheel = document.getElementById('wheel');
        const ball = document.getElementById('ball');

        // turn wheel counterclockwise 360 deg turns plus some random shift
        wheel.style.transform = 'rotate(' + (turns*-360+shift) + 'deg)';
        wheel.style.transition = 'all ' + wheelTrunDur*turns + 's linear';
        // turn ball clockwise on top of wheel twice as fat plus winSlotDeg for winning number
        ball.style.transform = 'rotate(' + (1.5*turns*360+winSlotDeg) + 'deg)  translateY(0px)';
        ball.style.transition = 'all ' + wheelTrunDur*turns + 's ease-out';

        wheel.addEventListener('transitionend', function(){
            //victory lap - show ball stationary on winning number
            console.log('done');
            // extra turn w ball
            wheel.style.transition = 'all ' + wheelTrunDur*(2+turns) + 's ease-out';
            wheel.style.transform = 'rotate(' + ((2+turns)*-360+shift) + 'deg)';
            ball.style.transition = 'all 0.5s ease-in';
            ball.style.transform = 'rotate(' + (1.5*turns*360+winSlotDeg) + 'deg) translateY(36px)';

        });

    }

    // FIXME Just for debug.
    window.onload = function(){
        initLayout(document.getElementById('layout'));

        // setInterval(spin, 2000);
        spin(2, Math.floor(Math.random() * 37))


    };

}());
