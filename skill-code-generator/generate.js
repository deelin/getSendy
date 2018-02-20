// Skill Code
//

// const gen = function(rawmodel, options, callback) {
//
//     console.log(options);
//     let model = JSON.parse(rawmodel);
//     let invocationName = model.languageModel.invocationName;
//     let intents = model.languageModel.intents;
//
//     return assemble(invocationName, intents, options);
// };

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    exports.handler = gen;  // node.js command line
} else {
    window.handler = gen;  // within browser
}

// function gen(invocationName, intents, options) {
function gen(rawmodel, options, callback) {
    // console.log(options);
    let model = JSON.parse(rawmodel);
    let invocationName = model.languageModel.invocationName;
    let intents = model.languageModel.intents;

    let appId = function(appId){
        return `const APP_ID = ${appId ? '"' + appId + '";\n' : 'undefined;  // TODO replace with your app ID (OPTIONAL).\n' }`;
    };

    const introComments = '// SkillCode generated code.\n' +
        '// Paste this into an AWS Lambda function based on the Fact blueprint.\n\n';
    const staticData = "const languageStrings = {\n" +
        "   'en': {\n" +
        "        'translation': {\n" +
        "            'WELCOME1' : 'Welcome to " + invocationName + "!',\n" +
        "            'WELCOME2' : 'Greetings!',\n" +
        "            'WELCOME3' : 'Hello there!',\n" +

        "            'HELP'    : 'You can say help, stop, or cancel. ',\n" +
        "            'STOP'    : 'Goodbye!'\n" +
        "        }\n    }\n" +
        "    // , 'de-DE': { 'translation' : { 'WELCOME'   : 'German Welcome etc.' } }\n" +
        "    // , 'jp-JP': { 'translation' : { 'WELCOME'   : 'Japanese Welcome etc.' } }\n" +
        "};\n" +
        appId(options.SkillID);

    const pre =
        '\n' +
        'const Alexa = require("alexa-sdk");\n' +
        'const https = require("https");\n' +

        (options.AWS ?
                'const AWS = require("aws-sdk");\n' +
                '    AWS.config.update({region: "' + options.AWSregion + '"});\n\n'
                :
                '\n'
        ) +

        'exports.handler = function(event, context, callback) {\n' +
        '    let alexa = Alexa.handler(event, context);\n' +
        '    alexa.appId = APP_ID; // \n\n' +
        '    alexa.resources = languageStrings;\n' +
        ' ' + (options.Dynamo ? '   ' : '// ')   +
        'alexa.dynamoDBTableName = "' + (options.Dynamo ? options.DynamoTable : 'myTable') + '"; // persistent session attributes\n' +
        // (options.DynamoDBTableName ? "  // flea  ":"// fare "); // + " alexa.dynamoDBTableName = 'YourTableName'; // creates new table for session.attributes \n" +
        '    alexa.registerHandlers(handlers);\n' +
        // '    getCustomIntents();\n' +
        '    alexa.execute();\n' +
        '}\n\n';


    const skill_name = 'const invocationName = "' + invocationName + '";\n\n';
    var handlers = 'const handlers = {\n';

    intents.push({"name":"LaunchRequest"});

    for (let i = 0; i < intents.length; i++) {
        // console.log(intents[i].name);
        handlers += intentCode(intents[i], options, model);
    }

    handlers += "    'Unhandled': function () {\n" +
        "        let say = 'The skill did not quite understand what you wanted.  Do you want to try something else? ';\n" +
        "        this.response\n" +
        "          .speak(say)\n" +
        "          .listen(say);\n" +
        "}";

    handlers += '};\n';


    let post = ' // End Skill Code\n';


    post += '// Language Model  for reference\n' +
        'var interactionModel = ' + JSON.stringify(intents, null, 2) + ';\n' +
        'var intentsReference = ' + JSON.stringify(intents, null, 2) + ';\n';

    const assembled = introComments + skill_name +  staticData  + pre  + handlers + helpers(options, model) + post;

    return assembled;
}

function intentCode(intent, options, mod) {

    var handlerFunction = "    '" + intent.name + "': function () {\n";
    var handler = '';
    if (intent.name == 'AMAZON.HelpIntent') {
        handler += "\n" +
            "        var CustomIntents = getCustomIntents();\n" +
            "        var MyIntent = randomPhrase(CustomIntents);\n" +
            "        let say = 'Out of ' + CustomIntents.length + ' intents, here is one called, ' + MyIntent.name + ', just say, ' + MyIntent.samples[0];\n" +

            "        this.response\n" +
            "          .speak(say)\n" +
            "          .listen('try again, ' + say)\n" +
            "          .cardRenderer('Intent List', cardIntents(CustomIntents)); // , welcomeCardImg\n";

    } else if (intent.name == 'AMAZON.CancelIntent' || intent.name == 'AMAZON.StopIntent') {
        handler += "\n" +
            "        let say = 'Goodbye.';\n" +
            "        this.response\n" +
            "          .speak(say);\n";

    }
    else if (intent.name == 'RecommendationIntent') {
        RecommendationIntent = true;

        const dialogIntents = mod.dialog.intents;
        const types = mod.languageModel.types;

        let requiredSlots = getRequiredSlots(dialogIntents, "RecommendationIntent");
        // let requiredSlotMap = getSlotValuesFromListofRequiredSlots(types, requiredSlots);

        var helperCode = '';
        helperCode += "        // delegate to Alexa to collect all the required slots \n";
        // helperCode += "        let isTestingWithSimulator = false; //autofill slots when using simulator, dialog management is only supported with a device \n";
        helperCode += "        let filledSlots = delegateSlotCollection.call(this); \n";
        helperCode += " \n";
        helperCode += "        if (!filledSlots) { \n";
        helperCode += "            return; \n";
        helperCode += "        } \n";
        helperCode += " \n";
        helperCode += "        console.log(\"filled slots: \" + JSON.stringify(filledSlots)); \n";
        helperCode += "        // at this point, we know that all required slots are filled. \n";
        helperCode += "        let slotValues = getSlotValues(filledSlots); \n";
        helperCode += " \n";
        helperCode += "        console.log(JSON.stringify(slotValues)); \n";
        helperCode += " \n";
        let key = '';
        requiredSlots.forEach((slot, index) => {
            if (slot.type.startsWith("AMAZON.")) {
                return false;
            }
            key += `\${slotValues.${slot.name}.resolved}${(index < requiredSlots.length - 1)? "-" : ""}`;
        });
        helperCode += `        let key = \`${key}\`;\n`;
        helperCode += "        let option = options[slotsToOptionsMap[key.replace(/\\s|\\t/, '-')]]; \n";
        helperCode += " \n";
        helperCode += "        console.log(\"look up key: \", key,  \"object: \", option); \n";
        helperCode += " \n";
        helperCode += `        let speechOutput = 'You have filled ${requiredSlots.length} required slots. ' + \n`;

        requiredSlots.forEach(requiredSlot => {
            helperCode += `        '${requiredSlot.name} resolved to,  ' + slotValues.${requiredSlot.name}.resolved + '. ' + \n`;
        });
        
        helperCode += '`${(option) ? \'You should consider \' + option.name + \'. \' : \'\' }`\n;';

        helperCode += " \n";
        helperCode += "        console.log(\"Speech output: \", speechOutput); \n";
        helperCode += "        this.response.speak(speechOutput); \n";
        helperCode += "        this.emit(':responseReady'); \n";

        handler += helperCode;
        // handler += "\n" +
        //     "        let say = 'Occupation is ' + " + RecommendationIntent + ";\n" +
        //     "        this.response\n" +
        //     "          .speak(say);\n";

    }
    else if (intent.name == 'LaunchRequest') {

        // let say = this.t('WELCOME') + ' ' + this.t('HELP');
        handler += "        let say = " +
            (options.VarietyGreeting
                ? "randomPhrase([this.t('WELCOME1'),this.t('WELCOME2'),this.t('WELCOME3')] ) "
                : "this.t('WELCOME1')" ) +

            " + ' ' + this.t('HELP');\n" +
            "        this.response\n" +
            "          .speak(say)\n" +
            "          .listen('try again, ' + say);\n";

    } else {  //  normal Intent *****************************************************************************

        const types = mod.languageModel.types;
        let requiredSlots = [];

        if (mod.hasOwnProperty('dialog'))  {  // DM model
            console.log('*** DM MODEL');
            dialogIntents = mod.dialog.intents;

            requiredSlots = getRequiredSlots(dialogIntents, intent.name);

            // let requiredSlotMap = getSlotValuesFromListofRequiredSlots(types, requiredSlots);
        }
        if (requiredSlots.length > 0) {
            console.log('### required slots');


            var helperCode = '';
            helperCode += "        // delegate to Alexa to collect all the required slots \n";
            helperCode += "        let isTestingWithSimulator = false; //autofill slots when using simulator, dialog management is only supported with a device \n";
            helperCode += "        let filledSlots = delegateSlotCollection.call(this, isTestingWithSimulator); \n";
            helperCode += " \n";
            helperCode += "        if (!filledSlots) { \n";
            helperCode += "            return; \n";
            helperCode += "        } \n";
            helperCode += " \n";
            helperCode += "        console.log(\"filled slots: \" + JSON.stringify(filledSlots)); \n";
            helperCode += "        // at this point, we know that all required slots are filled. \n";
            helperCode += "        let slotValues = getSlotValues(filledSlots); \n";
            helperCode += " \n";
            helperCode += "        console.log(JSON.stringify(slotValues)); \n";
            helperCode += " \n";
            // let key = '';
            // requiredSlots.forEach((slot, index) => {
            //     key += `\${slotValues.${slot.name}.resolved}${(index < requiredSlots.length - 1)? "-" : ""}`;
            // });
            // helperCode += `        let key = \`${key}\`;\n`;
            // helperCode += "        let option = options[slotsToOptionsMap[key]]; \n";
            // helperCode += " \n";
            // helperCode += "        console.log(\"look up key: \", key,  \"object: \", option); \n";
            helperCode += " \n";
            helperCode += `        let speechOutput = 'You have filled ${requiredSlots.length} required slots. ' + \n`;


            requiredSlots.forEach((requiredSlot, index) => {
                helperCode += `        '${requiredSlot.name} resolved to,  ' + slotValues.${requiredSlot.name}.resolved + '. ' ${ (index < requiredSlots.length - 1) ? '+' : ';' } \n`;
            });
            // helperCode += `        'You should consider ' + option.name + '. ';\n`;
            helperCode += " \n";
            helperCode += "        console.log(\"Speech output: \", speechOutput); \n";
            helperCode += "        this.response.speak(speechOutput); \n";
            helperCode += "        this.emit(':responseReady'); \n";

            handler += helperCode;


        } else {
            console.log('### no required slots');
            // handler += "        var filledSlots = delegateSlotCollection.call(this);\n";
            handler += "        let say = 'Hello from " + intent.name + ". ';\n\n";
            let slotSummary = '';
            if (intent.slots) {
                if (intent.slots.length > 0) {
                    handler += "        var slotStatus = '';\n";
                    handler += "        var resolvedSlot;\n\n";

                    // handler += "        if (this.event.request.dialogState) {\n" +
                    //     "            slotStatus += ' with Dialog Management ';\n" +
                    //     "        }\n";
                    // handler += "        var filledSlots = delegateSlotCollection.call(this);\n";


                    for (let i = 0; i < intent.slots.length; i++) {

                        // console.log('===> got ' + intent.slots[i].name);
                        handler += "    //   SLOT: " + intent.slots[i].name + " \n";
                        handler += "        if (this.event.request.intent.slots." + intent.slots[i].name + ".value) {\n" +
                            "            const " + intent.slots[i].name + " = this.event.request.intent.slots." + intent.slots[i].name + ";\n" +
                            "            slotStatus += ' slot " + intent.slots[i].name + " was heard as ' + " + intent.slots[i].name + ".value + '. ';\n\n" +

                            "            resolvedSlot = resolveCanonical(" + intent.slots[i].name + ");\n\n" +

                            "            if(resolvedSlot != " + intent.slots[i].name + ".value) {\n" +
                            "                slotStatus += ' which resolved to ' + resolvedSlot; \n" +
                            "            }\n" +
                            "        } else {\n";

                        handler += "            slotStatus += ' slot " + intent.slots[i].name + " is empty. ';\n";
                        handler += "        }\n\n";


                        slotSummary += "slot " + intent.slots[i].name + " is ' + " + intent.slots[i].name + ".value + '. ";

                    }

                    handler += "\n        say += slotStatus;\n\n";

                }
            }

            // handler += "\n        let say = 'Hello from " + intent.name + ". ' + slotStatus;\n\n" +
            handler +=     "        this.response\n" +
                "          .speak(say)\n" +
                "          .listen('try again, ' + say)" +
                (options.Cards ? "\n          .cardRenderer('" + intent.name + "', '" + slotSummary + "')" : "") +

                ";\n" +
                "\n";

        } // end if required slots



    }

    handlerFunction += handler + "\n        this.emit(':responseReady'); \n" +
        "    },\n";

    return handlerFunction;
}
// TAG

function helpers(options, mod) {
    var helperCode = '';
    helperCode += '//  ------ Helper Functions -----------------------------------------------\n\n' +
        'function randomPhrase(myArray) {\n' +
        '    return(myArray[Math.floor(Math.random() * myArray.length)]);\n' +
        '}\n\n' +
        '// returns slot resolved to an expected value if possible\n' +
        'function resolveCanonical(slot){\n' +
        '    try {\n' +
        '        var canonical = slot.resolutions.resolutionsPerAuthority[0].values[0].value.name;\n' +
        '    } catch(err){\n' +
        '        console.log(err.message);\n' +
        '        var canonical = slot.value;\n' +
        '    };\n' +
        '    return canonical;\n' +
        '};\n\n';

    helperCode += '// used to emit :delegate to elicit or confirm Intent Slots\n' +
        'function delegateSlotCollection(){\n' +
        '    console.log("current dialogState: " + this.event.request.dialogState);\n' +
        '    if (this.event.request.dialogState === "STARTED") {\n' +
        '        var updatedIntent = this.event.request.intent;\n\n' +
        // '        this.emit(":delegate", updatedIntent);\n\n' +
        '        this.emit(":delegate");\n\n' +
        '    } else if (this.event.request.dialogState !== "COMPLETED") {\n\n' +
        '        this.emit(":delegate");\n\n' +
        '    } else {\n' +
        '        console.log("returning: "+ JSON.stringify(this.event.request.intent));\n\n' +
        '        return this.event.request.intent;\n' +
        '    }\n' +
        '}\n\n';
    helperCode += 'function getCustomIntents() {\n' +
        '    var customIntents = [];\n' +
        '    for (let i = 0; i < intentsReference.length; i++) {\n' +
        '        if(intentsReference[i].name.substring(0,7) != "AMAZON." && intentsReference[i].name !== "LaunchRequest" ) {\n' +
        '            customIntents.push(intentsReference[i]);\n' +
        '        }\n' +
        '    }\n' +
        '    return(customIntents);\n' +
        '}\n' +
        'function cardIntents(iArray) {\n' +
        '    var body = "";' +
        '    for (var i = 0; i < iArray.length; i++) {\n' +
        '        body += iArray[i].name + "\\n";\n' +
        '        body += "  \'" + iArray[i].samples[0] + "\'\\n";\n' +
        '    }\n' +
        '    return(body);\n' +
        '}\n\n' +
        'const welcomeCardImg = {\n' +
        '    smallImageUrl: "https://m.media-amazon.com/images/G/01/mobile-apps/dex/alexa/alexa-skills-kit/alexa-devs-skill/cards/skill-builder-720x480._TTH_.png",\n' +
        '    largeImageUrl: "https://m.media-amazon.com/images/G/01/mobile-apps/dex/alexa/alexa-skills-kit/alexa-devs-skill/cards/skill-builder-1200x800._TTH_.png"\n' +
        '};\n\n';


    const modelIntents = mod.languageModel.intents; // array
    // need to find RecommendationIntent and then find slots and values

    let dialogIntents = [];

    if (RecommendationIntent) {

        dialogIntents = mod.dialog.intents;

        const types = mod.languageModel.types;

        // TODO : iterate through and build combinations of required slots similar to below

        let requiredSlots = getRequiredSlots(dialogIntents, "RecommendationIntent");

        console.log('required ',requiredSlots);

        if (requiredSlots.length !== 0) {
            helperCode += "const REQUIRED_SLOTS = [\n";
            requiredSlots.forEach((slot, index) => {
                helperCode += `    "${slot.name}"${ (index !== requiredSlots.length - 1) ? ',' : ''}\n`;
            });
            helperCode += "]; \n\n";
        }

        let requiredSlotMap = getSlotValuesFromListofRequiredSlots(types, requiredSlots);

        console.log('slot map', requiredSlotMap);
        let combitations = getCombitation(requiredSlotMap);

        console.log('combitations', combitations);

        helperCode += " \n";
        helperCode += "const slotsToOptionsMap = { \n";

        console.log("slotMap:", requiredSlotMap);

        let optionsList = '';
        combitations.forEach((combo, index) => {
            let suffix = (index != combitations.length - 1) ? ',' : '';
            helperCode += `    "${combo.join('-').replace(/\s|\t/, '-')}": ${index}${suffix}\n`;
            optionsList += `    {"name": "name_${index}", "description": "description_${index}"}${suffix}\n`;
        });

        helperCode += "};\n";
        helperCode += "\n";

        helperCode += "const options = [ \n";

        helperCode += optionsList;

        helperCode += "]; \n";
        helperCode += " \n";

        // todo: remove this we need to use the new testing simulator.

        // helperCode += "// This data is for testing purposes. \n";
        // helperCode += "// When isTestingWithSimulator is set to true \n";
        // helperCode += "// The slots will be auto loaded with this default data. \n";
        // helperCode += "// Set isTestingWithSimulator to false to disable to default data \n";
        // helperCode += "const defaultData = [ \n";
        // helperCode += "    { \n";
        // helperCode += "        'name': 'richness', \n";
        // helperCode += "        'value': 'billionaire', \n";
        // helperCode += "        'ERCode': 'ER_SUCCESS_MATCH', \n";
        // helperCode += "        'ERValues': [ \n";
        // helperCode += "            { 'value': 'rich' } \n";
        // helperCode += "        ] \n";
        // helperCode += "    }, \n";
        // helperCode += "    { \n";
        // helperCode += "        'name': 'personality', \n";
        // helperCode += "        'value': 'misunderstood', \n";
        // helperCode += "        'ERCode': 'ER_SUCCESS_MATCH', \n";
        // helperCode += "        'ERValues': [ \n";
        // helperCode += "            { 'value': 'introvert' }, \n";
        // helperCode += "        ] \n";
        // helperCode += "    }, \n";
        // helperCode += "    { \n";
        // helperCode += "        'name': 'affectionTarget', \n";
        // helperCode += "        'value': 'kittens', \n";
        // helperCode += "        'ERCode': 'ER_SUCCESS_MATCH', \n";
        // helperCode += "        'ERValues': [ \n";
        // helperCode += "            { 'value': 'animals' }, \n";
        // helperCode += "        ] \n";
        // helperCode += "    }, \n";
        // helperCode += "    { \n";
        // helperCode += "        'name': 'bloodTolerance', \n";
        // helperCode += "        'value': 'barf', \n";
        // helperCode += "        'ERCode': 'ER_SUCCESS_NO_MATCH', \n";
        // helperCode += "    }, \n";
        // helperCode += "]; \n";
        // helperCode += " \n";
    }

    helperCode += " \n";
    helperCode += "// *********************************** \n";
    helperCode += "// ** Helper functions from \n";
    helperCode += "// ** These should not need to be edited \n";
    helperCode += "// ** www.github.com/alexa/alexa-cookbook \n";
    helperCode += "// *********************************** \n";
    helperCode += " \n";
    helperCode += "// *********************************** \n";
    helperCode += "// ** Route to Intent \n";
    helperCode += "// *********************************** \n";
    helperCode += " \n";
    helperCode += "// after doing the logic in new session, \n";
    helperCode += "// route to the proper intent \n";
    helperCode += " \n";
    helperCode += "function routeToIntent() { \n";
    helperCode += " \n";
    helperCode += "    switch (this.event.request.type) { \n";
    helperCode += "        case 'IntentRequest': \n";
    helperCode += "            this.emit(this.event.request.intent.name); \n";
    helperCode += "            break; \n";
    helperCode += "        case 'LaunchRequest': \n";
    helperCode += "            this.emit('LaunchRequest'); \n";
    helperCode += "            break; \n";
    helperCode += "        default: \n";
    helperCode += "            this.emit('LaunchRequest'); \n";
    helperCode += "    } \n";
    helperCode += "} \n";
    helperCode += " \n";

    helperCode += "// *********************************** \n";
    helperCode += "// ** Dialog Management \n";
    helperCode += "// *********************************** \n";
    helperCode += " \n";

    helperCode += "function getSlotValues (filledSlots) { \n";
    helperCode += "    //given event.request.intent.slots, a slots values object so you have \n";
    helperCode += "    //what synonym the person said - .synonym \n";
    helperCode += "    //what that resolved to - .resolved \n";
    helperCode += "    //and if it's a word that is in your slot values - .isValidated \n";
    helperCode += "    let slotValues = {}; \n";
    helperCode += " \n";
    helperCode += "    console.log('The filled slots: ' + JSON.stringify(filledSlots)); \n";
    helperCode += "    Object.keys(filledSlots).forEach(function(item) { \n";
    helperCode += "        //console.log(\"item in filledSlots: \"+JSON.stringify(filledSlots[item])); \n";
    helperCode += "        var name = filledSlots[item].name; \n";
    helperCode += "        //console.log(\"name: \"+name); \n";
    helperCode += "        if(filledSlots[item]&& \n";
    helperCode += "            filledSlots[item].resolutions && \n";
    helperCode += "            filledSlots[item].resolutions.resolutionsPerAuthority[0] && \n";
    helperCode += "            filledSlots[item].resolutions.resolutionsPerAuthority[0].status && \n";
    helperCode += "            filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code ) { \n";
    helperCode += " \n";
    helperCode += "            switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) { \n";
    helperCode += "                case \"ER_SUCCESS_MATCH\": \n";
    helperCode += "                    slotValues[name] = { \n";
    helperCode += "                        \"synonym\": filledSlots[item].value, \n";
    helperCode += "                        \"resolved\": filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name, \n";
    helperCode += "                        \"isValidated\": true \n";
    helperCode += "                    }; \n";
    helperCode += "                    break; \n";
    helperCode += "                case \"ER_SUCCESS_NO_MATCH\": \n";
    helperCode += "                    slotValues[name] = { \n";
    helperCode += "                        \"synonym\": filledSlots[item].value, \n";
    helperCode += "                        \"resolved\": filledSlots[item].value, \n";
    helperCode += "                        \"isValidated\":false \n";
    helperCode += "                    }; \n";
    helperCode += "                    break; \n";
    helperCode += "            } \n";
    helperCode += "        } else { \n";
    helperCode += "            slotValues[name] = { \n";
    helperCode += "                \"synonym\": filledSlots[item].value, \n";
    helperCode += "                \"resolved\": filledSlots[item].value, \n";
    helperCode += "                \"isValidated\": false \n";
    helperCode += "            }; \n";
    helperCode += "        } \n";
    helperCode += "    },this); \n";
    helperCode += "    //console.log(\"slot values: \"+JSON.stringify(slotValues)); \n";
    helperCode += "    return slotValues; \n";
    helperCode += "} \n";

    helperCode += "// This function delegates multi-turn dialogs to Alexa. \n";
    helperCode += "// For more information about dialog directives see the link below. \n";
    helperCode += "// https://developer.amazon.com/docs/custom-skills/dialog-interface-reference.html \n";

    helperCode += "function delegateSlotCollection() { \n";
    helperCode += "    console.log(\"in delegateSlotCollection\"); \n";
    helperCode += "    console.log(\"current dialogState: \" + this.event.request.dialogState); \n";
    helperCode += " \n";
    // helperCode += "    // This will fill any empty slots with canned data provided in defaultData \n";
    // helperCode += "    // and mark dialogState COMPLETED. \n";
    // helperCode += "    // USE ONLY FOR TESTING IN THE SIMULATOR. \n";
    // helperCode += "    if (shouldFillSlotsWithTestData) { \n";
    // helperCode += "        let filledSlots = fillSlotsWithTestData.call(this, defaultData); \n";
    // helperCode += "        this.event.request.dialogState = \"COMPLETED\"; \n";
    // helperCode += "    }; \n";
    // helperCode += " \n";
    helperCode += "    if (this.event.request.dialogState === \"STARTED\") { \n";
    helperCode += "        console.log(\"in STARTED\"); \n";
    helperCode += "        console.log(JSON.stringify(this.event)); \n";
    helperCode += "        var updatedIntent=this.event.request.intent; \n";
    helperCode += "        // optionally pre-fill slots: update the intent object with slot values \n";
    helperCode += "        // for which you have defaults, then return Dialog.Delegate with this \n";
    helperCode += "        // updated intent in the updatedIntent property \n";
    helperCode += " \n";
    helperCode += "        disambiguateSlot.call(this); \n";
    helperCode += "        console.log(\"disambiguated: \" + JSON.stringify(this.event)); \n";
    helperCode += "        this.emit(\":delegate\", updatedIntent); \n";
    helperCode += "    } else if (this.event.request.dialogState !== \"COMPLETED\") { \n";
    helperCode += "        console.log(\"in not completed\"); \n";
    helperCode += "        //console.log(JSON.stringify(this.event)); \n";
    helperCode += " \n";
    helperCode += "        disambiguateSlot.call(this); \n";
    helperCode += "        this.emit(\":delegate\", updatedIntent); \n";
    helperCode += "    } else { \n";
    helperCode += "        console.log(\"in completed\"); \n";
    helperCode += "        //console.log(\"returning: \"+ JSON.stringify(this.event.request.intent)); \n";
    helperCode += "        // Dialog is now complete and all required slots should be filled, \n";
    helperCode += "        // so call your normal intent handler. \n";
    helperCode += "        return this.event.request.intent.slots; \n";
    helperCode += "    } \n";
    helperCode += "    return null; \n";
    helperCode += "} \n";

    // helperCode += " \n";
    // helperCode += "// this function will keep any slot values currently in the request \n";
    // helperCode += "// and will fill other slots with data from testData \n";
    // helperCode += "function fillSlotsWithTestData(testData) { \n";
    // helperCode += "    console.log(\"in fillSlotsWithTestData\"); \n";
    // helperCode += " \n";
    // helperCode += "    //console.log(\"testData: \"+JSON.stringify(testData)); \n";
    // helperCode += "    //loop through each item in testData \n";
    // helperCode += "    testData.forEach(function(item, index, arr) { \n";
    // helperCode += "        //check to see if the slot exists \n";
    // helperCode += "        //console.log(\"item: \"+JSON.stringify(item)); \n";
    // helperCode += "        if (!this.event.request.intent.slots[item.name].value) { \n";
    // helperCode += "            //fill with test data \n";
    // helperCode += "            //construct the element \n";
    // helperCode += "            let newSlot = { \n";
    // helperCode += "                \"name\": item.name, \n";
    // helperCode += "                \"value\": item.value, \n";
    // helperCode += "                \"resolutions\": { \n";
    // helperCode += "                    \"resolutionsPerAuthority\": [ \n";
    // helperCode += "                        { \n";
    // helperCode += "                            \"authority\": \"\", \n";
    // helperCode += "                            \"status\": { \n";
    // helperCode += "                                \"code\": item.ERCode, \n";
    // helperCode += "                            }, \n";
    // helperCode += "                        } \n";
    // helperCode += "                    ] \n";
    // helperCode += "                }, \n";
    // helperCode += "                \"confirmationStatus\": \"CONFIRMED\" \n";
    // helperCode += "            }; \n";
    // helperCode += " \n";
    // helperCode += "            //add Entity resolution values \n";
    // helperCode += "            if (item.ERCode == \"ER_SUCCESS_MATCH\") { \n";
    // helperCode += "                let ERValuesArr = []; \n";
    // helperCode += "                item.ERValues.forEach(function(ERItem){ \n";
    // helperCode += "                    let value = { \n";
    // helperCode += "                        \"value\": { \n";
    // helperCode += "                            \"name\": ERItem.value, \n";
    // helperCode += "                            \"id\": \"\" \n";
    // helperCode += "                        } \n";
    // helperCode += "                    }; \n";
    // helperCode += "                    ERValuesArr.push(value); \n";
    // helperCode += "                }) \n";
    // helperCode += "                newSlot.resolutions.resolutionsPerAuthority[0].values=ERValuesArr; \n";
    // helperCode += "            } \n";
    // helperCode += " \n";
    // helperCode += "            //add the new element to the response \n";
    // helperCode += "            this.event.request.intent.slots[item.name]=newSlot; \n";
    // helperCode += "        } \n";
    // helperCode += "    },this); \n";
    // helperCode += " \n";
    // helperCode += "    //console.log(\"leaving fillSlotsWithTestData\"); \n";
    // helperCode += "    return this.event.request.intent.slots; \n";
    // helperCode += "} \n";
    // helperCode += " \n";


    helperCode += "// If the user said a synonym that maps to more than one value, we need to ask \n";
    helperCode += "// the user for clarification. Disambiguate slot will loop through all slots and \n";
    helperCode += "// elicit confirmation for the first slot it sees that resolves to more than \n";
    helperCode += "// one value. \n";

    helperCode += "function disambiguateSlot() { \n";
    helperCode += "    let currentIntent = this.event.request.intent; \n";
    helperCode += " \n";
    helperCode += "    Object.keys(this.event.request.intent.slots).forEach(function(slotName) { \n";
    helperCode += "        let currentSlot = this.event.request.intent.slots[slotName]; \n";
    helperCode += "        let slotValue = slotHasValue(this.event.request, currentSlot.name); \n";
    helperCode += "        if (currentSlot.confirmationStatus !== 'CONFIRMED' && \n";
    helperCode += "            currentSlot.resolutions && \n";
    helperCode += "            currentSlot.resolutions.resolutionsPerAuthority[0]) { \n";
    helperCode += " \n";
    helperCode += "            if (currentSlot.resolutions.resolutionsPerAuthority[0].status.code == 'ER_SUCCESS_MATCH') { \n";
    helperCode += "                // if there's more than one value that means we have a synonym that \n";
    helperCode += "                // mapped to more than one value. So we need to ask the user for \n";
    helperCode += "                // clarification. For example if the user said \"mini dog\", and \n";
    helperCode += "                // \"mini\" is a synonym for both \"small\" and \"tiny\" then ask \"Did you \n";
    helperCode += "                // want a small or tiny dog?\" to get the user to tell you \n";
    helperCode += "                // specifically what type mini dog (small mini or tiny mini). \n";
    helperCode += "                if ( currentSlot.resolutions.resolutionsPerAuthority[0].values.length > 1) { \n";
    helperCode += "                    let prompt = 'Which would you like'; \n";
    helperCode += "                    let size = currentSlot.resolutions.resolutionsPerAuthority[0].values.length; \n";
    helperCode += "                    currentSlot.resolutions.resolutionsPerAuthority[0].values.forEach(function(element, index, arr) { \n";
    helperCode += "                        prompt += ` ${(index == size -1) ? ' or' : ' '} ${element.value.name}`; \n";
    helperCode += "                    }); \n";
    helperCode += " \n";
    helperCode += "                    prompt += '?'; \n";
    helperCode += "                    let reprompt = prompt; \n";
    helperCode += "                    // In this case we need to disambiguate the value that they \n";
    helperCode += "                    // provided to us because it resolved to more than one thing so \n";
    helperCode += "                    // we build up our prompts and then emit elicitSlot. \n";
    helperCode += "                    this.emit(':elicitSlot', currentSlot.name, prompt, reprompt); \n";
    helperCode += "                } \n";
    helperCode += "            } else if (currentSlot.resolutions.resolutionsPerAuthority[0].status.code == 'ER_SUCCESS_NO_MATCH') { \n";
    helperCode += "                // Here is where you'll want to add instrumentation to your code \n";
    helperCode += "                // so you can capture synonyms that you haven't defined. \n";
    helperCode += "                console.log(\"NO MATCH FOR: \", currentSlot.name, \" value: \", currentSlot.value); \n";
    helperCode += " \n";
    helperCode += "                if (REQUIRED_SLOTS.indexOf(currentSlot.name) > -1) { \n";
    helperCode += "                    let prompt = \"What \" + currentSlot.name + \" are you looking for\"; \n";
    helperCode += "                    this.emit(':elicitSlot', currentSlot.name, prompt, prompt); \n";
    helperCode += "                } \n";
    helperCode += "            } \n";
    helperCode += "        } \n";
    helperCode += "    }, this); \n";
    helperCode += "} \n";
    helperCode += " \n";

    helperCode += "// Given the request an slot name, slotHasValue returns the slot value if one \n";
    helperCode += "// was given for `slotName`. Otherwise returns false. \n";
    helperCode += "function slotHasValue(request, slotName) { \n";
    helperCode += " \n";
    helperCode += "    let slot = request.intent.slots[slotName]; \n";
    helperCode += " \n";
    helperCode += "    //uncomment if you want to see the request \n";
    helperCode += "    //console.log(\"request = \"+JSON.stringify(request)); \n";
    helperCode += "    let slotValue; \n";
    helperCode += " \n";
    helperCode += "    //if we have a slot, get the text and store it into speechOutput \n";
    helperCode += "    if (slot && slot.value) { \n";
    helperCode += "        //we have a value in the slot \n";
    helperCode += "        slotValue = slot.value.toLowerCase(); \n";
    helperCode += "        return slotValue; \n";
    helperCode += "    } else { \n";
    helperCode += "        //we didn't get a value in the slot. \n";
    helperCode += "        return false; \n";
    helperCode += "    } \n";
    helperCode += "} \n";



    return(helperCode);
}

function getCombitation(arrays, combine = [], finalList = []) {
    if (!arrays.length) {
        if (combine.length) {
            finalList.push(combine);
        }
    } else {
        arrays[0].forEach(now => {
            let nextArrs = arrays.slice(1);
            let copy = combine.slice();
            copy.push(now);
            getCombitation(nextArrs, copy, finalList);
        });
    }
    return finalList;
}

function getPermutation(array, prefix) {
    prefix = prefix || '';
    if (!array.length) {
        return prefix;
    }

    var result = array[0].reduce(function (result, value) {
        return getPermutation(array.slice(1));
        //return result.concat(getPermutation(array.slice(1), prefix + value, '-'));
    }, []);
    return result;
}

function getRequiredSlots(dialogIntents, forIntent) {
    let results = []
    dialogIntents.forEach(intent => {
        if ( intent.name === forIntent) {
            intent.slots.forEach(slot => {
                if (slot.elicitationRequired) {
                    results.push(slot);
                }
            });
        }
    });

    return results;
}

function getSlotValuesFromListofRequiredSlots(types, requiredSlots)
{
    let results = [];

    if (types && requiredSlots) {
        requiredSlots.forEach(requiredSlot => {
            types.forEach(type => {
                if (type.name == requiredSlot.type) {
                    let values = [];
                    type.values.forEach(value => {
                        values.push(value.name.value);
                    });
                    results.push(values);
                }
            })
        });
    }
    return results;
}
let RecommendationIntent = false;

// console.log(RecommendationIntent);