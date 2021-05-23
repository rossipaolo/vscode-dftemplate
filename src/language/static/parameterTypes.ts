/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

/**
 * Placeholders for snippets used by completion proposals provider.
 * The type is both a meaningful name to be shown on gui (prettified) and a hint for diagnostics.
 */
export abstract class ParameterTypes {
    
    public static readonly naturalNumber = '${nn}';
    public static readonly integerNumber = '${dd}';
    public static readonly time = '${hh}:${mm}';
    public static readonly questID = '${questID}';
    public static readonly questName = '${questName}';
    public static readonly message = '${message}';
    public static readonly messageID = '${messageID}';
    public static readonly messageName = '${messageName}';
    public static readonly symbol = '${_symbol_}';
    public static readonly clockSymbol = '${_clock_}';
    public static readonly foeSymbol = '${_foe_}';
    public static readonly itemSymbol = '${_item_}';
    public static readonly personSymbol = '${_person_}';
    public static readonly placeSymbol = '${_place_}';
    public static readonly task = '${task}';
    public static readonly disease = '${disease}';
    public static readonly spell = '${spell}';
    public static readonly effectKey = "${effectKey}";
    public static readonly faction = '${faction}';
    public static readonly factionType = '${factionType}';
    public static readonly group = '${group}';
    public static readonly foe = '${foe}';
    public static readonly commonItem = '${commonItem}';
    public static readonly artifactItem = '${artifactItem}';
    public static readonly localRemotePlace = '${localRemotePlace}';
    public static readonly permanentPlace = '${permanentPlace}';
    public static readonly locationType = '${locationType}';
    public static readonly sound = '${sound}';
    public static readonly attributeName = '${attributeName}';
    public static readonly skillName = '${skillName}';
    public static readonly season = '${season}';
    public static readonly weather = '${weather}';
    public static readonly climate = '${climate}';
    public static readonly baseClimate = '${baseClimate}';

    /**
    * Gets the description of a parameter for its type.
    * @param parameterType A known parameter type;
    */
    public static getDescription(parameterType: string): string | undefined {
        switch (parameterType) {
            case ParameterTypes.naturalNumber:
                return 'A positive number.';
            case ParameterTypes.integerNumber:
                return 'A positive or negative number with a sign.';
            case ParameterTypes.questID:
                return 'The index of a __S000nnnn__ quest, meaning the last digits without leading zeros.';
            case ParameterTypes.questName:
                return 'The name of a quest as defined in the **Quest:** directive.';
            case ParameterTypes.message:
                return 'A message reference as a numeric ID or text alias.';
            case ParameterTypes.messageID:
                return 'The numeric ID of a message.';
            case ParameterTypes.messageName:
                return 'The text alias of a static message.';
            case ParameterTypes.symbol:
                return 'A symbolic reference of any kind.';
            case ParameterTypes.clockSymbol:
                return 'A symbolic reference to a clock, meaning a symbol of type `Clock`.';
            case ParameterTypes.foeSymbol:
                return 'A symbolic reference to an enemy entity, meaning a symbol of type `Foe`.';
            case ParameterTypes.itemSymbol:
                return 'A symbolic reference to an item, meaning a symbol of type `Item`.';
            case ParameterTypes.personSymbol:
                return 'A symbolic reference to an NPC, meaning a symbol of type `Person`.';
            case ParameterTypes.placeSymbol:
                return 'A symbolic reference to a location, meaning a symbol of type `Place`.';
            case ParameterTypes.task:
                return 'The symbol of a task or variable.';
            case ParameterTypes.disease:
                return 'The name of a disease afflicted during a quest or through exposure to various elements.';
            case ParameterTypes.effectKey:
                return 'An unique text key to identify an effect.';
            case ParameterTypes.faction:
                return 'The name of one of the factions.';
            case ParameterTypes.factionType:
                return 'The name of one of the faction types.';
            case ParameterTypes.group:
                return 'The name of one of the social groups or guilds';
            case ParameterTypes.foe:
                return 'The name of a type of enemy.';
            case ParameterTypes.commonItem:
                return 'The name of a prefabricated common item.';
            case ParameterTypes.artifactItem:
                return 'The name of one of the Tamriel artifacts.';
            case ParameterTypes.localRemotePlace:
                return 'A kind of house, shop or dungeon in a town.';
            case ParameterTypes.permanentPlace:
                return 'The name of a location that appears the same for every **Daggerfall** incarnation.';
            case ParameterTypes.locationType:
                return 'A type of exterior location that appears on the automap, such as a settlement or dungeon.';
            case ParameterTypes.sound:
                return 'The name of a sound, such as a model creature noise or an environmental sound effect.';
            case ParameterTypes.attributeName:
                return 'The name of an attribute.';
            case ParameterTypes.skillName:
                return 'The name of a skill.';
            case ParameterTypes.season:
                return 'The name of the season';
            case ParameterTypes.weather:
                return 'The name of the weather type';
            case ParameterTypes.climate:
                return 'The specific climate of a region';
            case ParameterTypes.baseClimate:
                return 'The general climate of a region';
        }
    }

    /**
     * Returns true if the given parameter type doesn't have a special syntax,
     * meaning that it can be considered a raw text string.
     * */
    public static isRawInput(type: string, value: string) {
        if (!type.startsWith('${') || type.endsWith('|}') || type.endsWith('%')) {
            return false;
        }

        switch (type) {
            case ParameterTypes.clockSymbol:
            case ParameterTypes.foeSymbol:
            case ParameterTypes.integerNumber:
            case ParameterTypes.itemSymbol:
            case ParameterTypes.itemSymbol:
            case ParameterTypes.messageID:
            case ParameterTypes.naturalNumber:
            case ParameterTypes.personSymbol:
            case ParameterTypes.placeSymbol:
            case ParameterTypes.questID:
            case ParameterTypes.questName:
            case ParameterTypes.symbol:
            case ParameterTypes.task:
            case ParameterTypes.time:
                return false;
            case ParameterTypes.message:
                return isNaN(Number(value));
        }

        return true;
    }
}