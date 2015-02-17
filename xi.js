define(function () {

    /**
     * Returns true if the given argument is either an array or an arguments array-like object
     */
    function isArrayLike(args) {
        // quick duck type check
        //return args && args.callee && typeof (args.length != undefined);
        var ret = false,
            typeofArgs = typeof args;

        switch (typeofArgs) {
        case "array": 
            ret = true;
            break;
        case "object": 
            if (args.length !== undefined) {
                if (!(args instanceof String)) {
                    ret = true;
                    // we could add additional checks here, but seems pretty safe
                }
            }
            break;
        }

        return ret;
    }

    //////////////////
    // Begin XElement

    function XElement(elementName, elementArguments) {
        // fastest possible safe type check
        this.isaXElement = true;
        // basic things that elements have -  name, attributes, children
        this.elementName = elementName;
        this.rgAttributes = [];
        this.rgChildren = [];

        // elementArguments is an array-like sequence of arguments
        //  where each elemArgument can be:
        //  1) a primitive type - number or string - in this case, it's a child
        //  2) an array of attributes - flatten, add each attribute
        //  3) an XAttribute

        this.addElementArguments(elementArguments);
    }

    XElement.prototype.addElementArguments = function (elementArguments) {
        var i,
            len = (elementArguments && elementArguments.length) || 0,
            elementArgument = null;
        for (i = 0; i < len; i += 1) {
            elementArgument = elementArguments[i];

            if (elementArgument) {
                if (isArrayLike(elementArgument)) {
                    // flatten
                    this.addElementArguments(elementArgument);
                } else {
                    if (elementArgument.isaXAttr) {
                        this.addAttribute(elementArgument);
                    } else {
                        this.addChild(elementArgument);
                    }
                }
            }
        }
    };

    XElement.prototype.addAttribute = function (attribute) {
        var _this = this;

        if (attribute) {
            if (attribute.isaXAttr) {
                this.rgAttributes.push(attribute);
                if (attribute.setParent) {
                    attribute.setParent(this);
                }               
            } 
        }
       
        return this;
    };

    XElement.prototype.addChildren = function () {
        var i,
            lenArguments = arguments.length || 0;

        for (i = 0; i < lenArguments; i += 1) {
            this.addChild(arguments[i]);
        }
        return this;

    };

    XElement.prototype.addChild = function (child) {
        if (child) {
            // if not an array
            if (typeof child === "string" || typeof child.length === "undefined") {
                this.rgChildren.push(child);
                // todo - the following is an interesting idea for making a mini pseudo dom or something...
                //if (child.setParent) {
                //    child.setParent(this);
                //}
            } else {
                this.addChildren(child);
            }
        } // else throw or something

        return this;
    };

    XElement.prototype.render = function () {
        var ret,
            sAttributes = "",
            sChildren = "";

        // generate attributes string
        this.rgAttributes.forEach(function (attr) {
            if (attr && attr.render) {
                sAttributes += " " + attr.render();
            } // else throw or something
        });

        // render child strings
        this.rgChildren.forEach(function (child) {
            if (child) {
                sChildren += child.render ? child.render() : child.toString();
            }
        });

        if (this.elementName) {
            ret = "<" + this.elementName + sAttributes + ">" + sChildren + "</" + this.elementName + ">";    
        } else {
            // this is not a proper element, but just a collection of children that can still be rendered
            ret = sChildren;
            // TODO - throw or something is sAttributes is non-empty in this case
        } 

        return ret;
    };


    /**
     * Searches for attributes using a regular expression. Searches children.
     * @param {RegExp} - regExpOfAttributeName - the regular expression that will be tested against the attribute's name
     * @param {array} - array of XAttribute objects - if set, new matches will be added to this array, and this array returned
     * @return {array} - array of XAttribute objects, where the nameOfAttribute matches regExpOfAttributeName
     */
    XElement.prototype.findAttributes = function (regExpOfAttributeName, arrayResults) {
        if (!arrayResults) {
            arrayResults = [];
        }

        if (regExpOfAttributeName && regExpOfAttributeName.test) {
            // search attributes of this element
            this.rgAttributes.map(function (attribute) {
                if (regExpOfAttributeName.test(attribute.nameOfAttribute)) {
                    arrayResults.push(attribute);
                }
            });

            //search attributes of all child elements (recursive)
            this.rgChildren.map(function (childElement) {
                if (childElement && childElement.findAttributes) {
                    childElement.findAttributes(regExpOfAttributeName, arrayResults);
                }
            });
        } // else throw or something

        return arrayResults;
    };    

    XElement.prototype.bindToDojoObject = function (objectToBindTo) {
        // plan
        //  find xbinding attributes
        //  for each xbinding, construct a query string
        //      filter for unique bindings
        //      call objectToBindTo.on(queryString, objectToBindTo[methodName])

        // find xbinding attributes
        var arrayBindingAttributes = this.findAttributes(/data-xbind-/),
            arrayUniqueXueryStrings = [];
        
        // generate query strings
        arrayBindingAttributes.map(function (attr) {
            var elementName, dojoXueryString;
            if (attr.parent) {
                elementName = attr.parent.elementName;
                
                dojoXueryString = elementName + "[" + attr.nameOfAttribute + "=" + attr.value + "]:" + attr.eventName;
                if (-1 === arrayUniqueXueryStrings.indexOf(dojoXueryString)) {
                    arrayUniqueXueryStrings.push(attr.dojoXueryString);
                    // we have a unique query string, do the attachment
                    objectToBindTo.on(dojoXueryString, function () {
                        // call the handler
                        objectToBindTo[attr.methodName](attr.parameter);
                    });
                }
            }
        });        

        // return this for chaining
        return this;
    };

    // The method named "_" is just a shorthand for 'addChildren'
    XElement.prototype._ = XElement.prototype.addChildren;

    //////////////////
    // Begin XAttribute
    function XAttribute(nameOfAttribute, value) {
        this.isaXAttr = true;
        this.nameOfAttribute = nameOfAttribute;
        this.value = value;
        //parent element
        this.parent = null;
    }

    XAttribute.prototype.setParent = function (parent) {
        this.parent = parent;
    };

    XAttribute.prototype.render = function () {
        // todo - probably need to escape value for quotes or something
        //var ret = this.nameOfAttribute + "='" + this.value + "'";
        var ret = this.nameOfAttribute + '="' + this.value + '"';
        return ret;
    };

    //////////////////
    // Begin Builder Methods

    //elements
    // p a img table tr td ul li ol form input textarea div span select
    function DIV() { return new XElement("div", arguments); }
    function SPAN() { return new XElement("span", arguments); }
    function PARAGRAPH() { return new XElement("p", arguments); }
    function UL() { return new XElement("ul", arguments); }
    function LI() { return new XElement("li", arguments); }
    function OL() { return new XElement("ol", arguments); }
    function FORM() { return new XElement("form", arguments); }
    function INPUT() { return new XElement("input", arguments); }
    function TEXTAREA() { return new XElement("textarea", arguments); }
    function IMG() {return new XElement("img", arguments); }
    function TABLE() { return new XElement("table", arguments); }
    function TR() { return new XElement("tr", arguments); }
    function TD() { return new XElement("td", arguments); }
    // this is named "ANCHOR" instead of "A" because otherwise lint complains
    function ANCHOR() { return new XElement("a", arguments); }

    // TODO - add all HTML elements, add type checking when possible

    // returns a XElement that just wraps a collection of child elements
    function ELEMENTS(arrayOfElements) { return new XElement(null, arrayOfElements); }

    /**
     * Generic element function for any element not already created.  The first parameter is the name of the 
     * element, all other parameters work the same as for other element constructors
     * @param {string} - The name of the element
     * @return - an template object representing the element
     */
    function ELEM(elementName) { return new XElement(elementName, Array.prototype.slice.call(arguments).shift()); }
    

    // attributes
    //ATTR - for any generic attribute not already covered
    function ATTR(attributeName, attributeValue) {return new XAttribute(attributeName, attributeValue); }
    function DATA_VALUE(value) {return new XAttribute("data-value", value); }

    function HREF(value) {return new XAttribute("href", value); }
    function ARIA_LABEL(value) {return new XAttribute("aria-label", value); }
    function CLASS(value) {return new XAttribute("class", value); }



    function HREF_JAVASCRIPT(jsUrl) {
        // the next couple lines are to avoid a linter warning about javascript urls.
        var js = "javascript";
        return new HREF(js + ":" + jsUrl);
    }

    //////////
    // begin special bind attributes
    function XBIND(eventName, methodName, parameter) {
        var ret = new XAttribute("data-xbind-" + eventName, methodName + " " + parameter, true); 
        // TODO - probably should just go ahead and make a new XBind object/constructor
        //      property baging like this hurts readability in  the long term
        ret.eventName = eventName;
        ret.methodName = methodName;
        ret.parameter = parameter;
        return ret;
    }

    function XBIND_CLICK(methodName, parameter) {return XBIND("click", methodName, parameter); }


    /**
     * Inline syntactic sugar - similar to a ternary, except that ternaries short-circuit evaluation
     */
    function IF(condition, valueToReturn, elseValueToReturn) {
        return condition ? valueToReturn : elseValueToReturn;
    }

    /**
     * Returns true if condition is a non-empty array (or a truthy non-array)
     */
    function hasAny(condition) {
        var ret = false;

        if (isArrayLike(condition)) {
            ret = condition.length > 0;
            // TODO - we could also iterate and make sure that the array-like object has at least one truthy object
        } else {
            ret = !!condition;
        }

        return ret;
    }

    /**
     * Evaluates condition as true if 'condition' is a non-empty array (or a truthy non-array)
     */
    function IF_ANY(condition, valueToReturn, elseValueToReturn) {
        return hasAny(condition) ? valueToReturn : elseValueToReturn;
    }

    function IF_NOT_ANY(condition, valueToReturn, elseValueToReturn) {
        return !hasAny(condition) ? valueToReturn : elseValueToReturn;
    }

    function FOR_EACH(array, callback) {
        var ret;
        if (isArrayLike(array)) {
            if (!array.map) {
                array = Array.prototype.slice.call(arguments);
            }
            ret = array.map(callback);
        } else {
            // todo - maybe in this case return [array].map(callback);
            ret = [];
        }

        return ret;
    }


    function FOR_EACH_old(array, callback) {
        var ret;
        if (array && array.length) {
            ret = array.map(callback);
        } else {
            ret = [];
        }
        return ret;
    }

    var HREF_JAVASCRIPT_VOID = HREF_JAVASCRIPT("void(0)");

    return {
        /** 
         * Generates a XElement
         */
        def1: function (callback) {
            var ret = callback(IF, FOR_EACH, IF_NOT_ANY, DIV, SPAN, PARAGRAPH, UL, LI, OL, FORM, INPUT, TEXTAREA, IMG, TABLE, TR, TD, ANCHOR,
                DATA_VALUE, XBIND_CLICK, HREF, ARIA_LABEL, CLASS, HREF_JAVASCRIPT_VOID);
            // if the returned value can be rendered, just return it, otherwise its an array of elements, that
            //  need to be wrapped in order to be rendered...
            return ret.render ? ret : ELEMENTS(ret);
            
            /* So the intended use pattern...
            return xijs.def1(function (DIV, SPAN, PARAGRAPH, UL, LI, OL, FORM, INPUT, TEXTAREA, IMG, TABLE, TR, TD, ANCHOR,
                     ATTR, HREF, ARIA_LABEL, CLASS, HREF_JAVASCRIPT_VOID) { return (

                // Template code goes here, for example:
                DIV(CLASS("MyBorder"))._(
                    SPAN("Hello World")
                )
            ); });
            */
        }

    };
});
