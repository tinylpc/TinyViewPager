'use strict';

var React = require('react');
var {PropTypes} = React;

var ReactNative = require('react-native');
var {
    Dimensions,
    Text,
    View,
    TouchableOpacity,
    PanResponder,
    Animated,
    StyleSheet,
} = ReactNative;

var StaticRenderer = require('react-native/Libraries/Components/StaticRenderer');
var TimerMixin = require('react-timer-mixin');

var DefaultViewPageIndicator = require('./DefaultViewPageIndicator');
var deviceWidth = Dimensions.get('window').width;
var deviceHeight = Dimensions.get('window').height;
var ViewPagerDataSource = require('./ViewPagerDataSource');

var ViewPager = React.createClass({
    mixins: [TimerMixin],

    statics: {
        DataSource: ViewPagerDataSource,
    },

    propTypes: {
        ...View.propTypes,
        dataSource: PropTypes.instanceOf(ViewPagerDataSource).isRequired,
        renderPage: PropTypes.func.isRequired,
        onChangePage: PropTypes.func,
        renderPageIndicator: PropTypes.oneOfType([
            PropTypes.func,
            PropTypes.bool
        ]),
        isLoop: PropTypes.bool,
        locked: PropTypes.bool,
        autoPlay: PropTypes.bool,
        animation: PropTypes.func,
        initialPage: PropTypes.number,
        horizontal: PropTypes.bool,
        duration: PropTypes.number,
    },

    fling: false,

    getDefaultProps() {
        return {
            isLoop: false,
            locked: false,
            horizontal: true,
            duration: 3000,
            animation: function (animate, toValue, gs) {
                return Animated.spring(animate,
                    {
                        toValue: toValue,
                        friction: 10,
                        tension: 50,
                    })
            },
        }
    },

    getInitialState() {
        return {
            currentPage: 0,
            viewValue: 0,
            scrollValue: new Animated.Value(0)
        };
    },

    componentWillMount() {
        this.childIndex = 0;

        var release = (e, gestureState) => {
            var relativeGestureDistance = this.props.horizontal ? gestureState.dx / deviceWidth : gestureState.dy / deviceHeight,
                //lastPageIndex = this.props.children.length - 1,
                value = this.props.horizontal ? gestureState.vx : gestureState.vy;

            var step = 0;
            if (relativeGestureDistance < -0.5 || (relativeGestureDistance < 0 && value <= -1e-6)) {
                step = 1;
            } else if (relativeGestureDistance > 0.5 || (relativeGestureDistance > 0 && value >= 1e-6)) {
                step = -1;
            }

            this.props.hasTouch && this.props.hasTouch(false);

            this.movePage(step, gestureState);
        }

        this._panResponder = PanResponder.create({
            // Claim responder if it's a horizontal pan
            onMoveShouldSetPanResponder: (e, gestureState) => {
                if (this.props.horizontal ? (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) : (Math.abs(gestureState.dx) < Math.abs(gestureState.dy))) {
                    if (/* (gestureState.moveX <= this.props.edgeHitWidth ||
                         gestureState.moveX >= deviceWidth - this.props.edgeHitWidth) && */
                    this.props.locked !== true && !this.fling) {
                        this.props.hasTouch && this.props.hasTouch(true);
                        return true;
                    }
                }
            },

            // Touch is released, scroll to the one that you're closest to
            onPanResponderRelease: release,
            onPanResponderTerminate: release,

            // Dragging, move the view with the touch
            onPanResponderMove: (e, gestureState) => {
                var dvalue = this.props.horizontal ? gestureState.dx : gestureState.dy;
                var offsety = -dvalue / this.state.viewValue + this.childIndex;
                this.state.scrollValue.setValue(offsety);
            },
        });

        if (this.props.isLoop) {
            this.childIndex = 1;
            this.state.scrollValue.setValue(1);
        }
        if (this.props.initialPage) {
            var initialPage = Number(this.props.initialPage);
            if (initialPage > 0) {
                this.goToPage(initialPage, false);
            }
        }
    },

    componentDidMount() {
        if (this.props.autoPlay) {
            this._startAutoPlay();
        }
    },

    componentWillReceiveProps(nextProps) {
        if (nextProps.autoPlay) {
            this._startAutoPlay();
        } else {
            if (this._autoPlayer) {
                this.clearInterval(this._autoPlayer);
                this._autoPlayer = null;
            }
        }

        if (nextProps.dataSource) {
            var maxPage = nextProps.dataSource.getPageCount() - 1;
            var constrainedPage = Math.max(0, Math.min(this.state.currentPage, maxPage));
            this.setState({
                currentPage: constrainedPage,
            });

            if (!nextProps.isLoop) {
                this.state.scrollValue.setValue(constrainedPage > 0 ? 1 : 0);
            }

            this.childIndex = Math.max(this.childIndex, constrainedPage);
            this.fling = false;
        }

    },

    _startAutoPlay() {
        if (!this._autoPlayer) {
            this._autoPlayer = this.setInterval(
                () => {
                    this.movePage(1);
                },
                this.props.duration
            );
        }
    },

    goToPage(pageNumber, animate = true) {

        var pageCount = this.props.dataSource.getPageCount();
        if (pageNumber < 0 || pageNumber >= pageCount) {
            console.error('Invalid page number: ', pageNumber);
            return
        }

        var step = pageNumber - this.state.currentPage;
        this.movePage(step, null, animate);
    },

    movePage(step, gs, animate = true) {
        var pageCount = this.props.dataSource.getPageCount();
        var pageNumber = this.state.currentPage + step;
        if (this.props.isLoop) {
            pageNumber = pageCount == 0 ? pageNumber = 0 : ((pageNumber + pageCount) % pageCount);
        } else {
            pageNumber = Math.min(Math.max(0, pageNumber), pageCount - 1);
        }

        const moved = pageNumber !== this.state.currentPage;
        const scrollStep = (moved ? step : 0) + this.childIndex;
        const nextChildIdx = (pageNumber > 0 || this.props.isLoop) ? 1 : 0;

        const postChange = () => {
            this.fling = false;
            this.childIndex = nextChildIdx;
            this.state.scrollValue.setValue(nextChildIdx);
            this.setState({
                currentPage: pageNumber,
            });
        };

        if (animate) {
            this.fling = true;
            this.props.animation(this.state.scrollValue, scrollStep, gs)
                .start((event) => {
                    if (event.finished) {
                        postChange();
                    }
                    moved && this.props.onChangePage && this.props.onChangePage(pageNumber);
                });
        } else {
            postChange();
            moved && this.props.onChangePage && this.props.onChangePage(pageNumber);
        }
    },

    setCurrentPageZero(){
        this.setState({
            currentPage: 0,
            viewValue: 0,
        })
    },

    getCurrentPage() {
        return this.state.currentPage;
    },

    renderPageIndicator(props) {
        if (this.props.renderPageIndicator === false) {
            return null;
        } else if (this.props.renderPageIndicator) {
            return React.cloneElement(this.props.renderPageIndicator(), props);
        } else {
            return (
                <View style={styles.indicators}>
                    <DefaultViewPageIndicator {...props} />
                </View>
            );
        }
    },

    _getPage(pageIdx: number, loop: boolean = false) {
        var dataSource = this.props.dataSource;
        var pageID = dataSource.pageIdentities[pageIdx];
        return (
            <StaticRenderer
                key={'p_' + pageID + (loop ? '_1' : '')}
                shouldUpdate={true}
                render={this.props.renderPage.bind(
                    null,
                    dataSource.getPageData(pageIdx),
                    pageID,
                    this.state.currentPage
                )}
            />
        );
    },

    render() {
        var dataSource = this.props.dataSource;
        var pageIDs = dataSource.pageIdentities;

        var bodyComponents = [];

        var pagesNum = 0;
        var hasLeft = false;
        var viewValue = this.state.viewValue;

        if (pageIDs.length > 0 && viewValue > 0) {
            // left page
            if (this.state.currentPage > 0) {
                bodyComponents.push(this._getPage(this.state.currentPage - 1));
                pagesNum++;
                hasLeft = true;
            } else if (this.state.currentPage == 0 && this.props.isLoop) {
                bodyComponents.push(this._getPage(pageIDs.length - 1, true));
                pagesNum++;
                hasLeft = true;
            }

            // center page
            bodyComponents.push(this._getPage(this.state.currentPage));
            pagesNum++;

            // right page
            if (this.state.currentPage < pageIDs.length - 1) {
                bodyComponents.push(this._getPage(this.state.currentPage + 1));
                pagesNum++;
            } else if (this.state.currentPage == pageIDs.length - 1 && this.props.isLoop) {
                bodyComponents.push(this._getPage(0, true));
                pagesNum++;
            }
        }

        var sceneContainerStyle = {
            width: this.props.horizontal ? viewValue * pagesNum : null,
            height: this.props.horizontal ? null : viewValue * pagesNum,
            flexDirection: this.props.horizontal ? 'row' : 'column',
        };

        // this.childIndex = hasLeft ? 1 : 0;
        // this.state.scrollValue.setValue(this.childIndex);
        var translateX = this.state.scrollValue.interpolate({
            inputRange: [0, 1], outputRange: [0, -viewValue]
        });

        var translateY = this.state.scrollValue.interpolate({
            inputRange: [0, 1], outputRange: [0, -viewValue]
        });

        let transform = this.props.horizontal ? [{translateX}] : [{translateY}]

        return (
            <View style={{flex: 1}}
                  onLayout={(event) => {
                      // console.log('ViewPager.onLayout()');
                      var viewValue = this.props.horizontal ? event.nativeEvent.layout.width : event.nativeEvent.layout.height;
                      if (!viewValue || this.state.viewValue === viewValue) {
                          return;
                      }
                      this.setState({
                          currentPage: this.state.currentPage,
                          viewValue: viewValue,
                      });
                  }}
            >

                <Animated.View
                    style={[sceneContainerStyle, {transform: transform}]}
                    {...this._panResponder.panHandlers}>
                    {bodyComponents}
                </Animated.View>

                {this.renderPageIndicator({
                    goToPage: this.goToPage,
                    pageCount: pageIDs.length,
                    activePage: this.state.currentPage,
                    scrollValue: this.state.scrollValue,
                    scrollOffset: this.childIndex,
                })}
            </View>
        );
    }
});

var styles = StyleSheet.create({
    indicators: {
        flex: 1,
        alignItems: 'center',
        position: 'absolute',
        bottom: 10,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
    },
});

module.exports = ViewPager;
