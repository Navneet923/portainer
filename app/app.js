import $ from 'jquery';
import '@babel/polyfill';

angular.module('portainer').run([
  '$rootScope',
  '$state',
  '$interval',
  'LocalStorage',
  'EndpointProvider',
  'SystemService',
  'cfpLoadingBar',
  '$transitions',
  'HttpRequestHelper',
  'EndpointService',
  'StateManager',
  'LegacyExtensionManager',
  function ($rootScope, $state, $interval, LocalStorage, EndpointProvider, SystemService, cfpLoadingBar, $transitions, HttpRequestHelper) {
    EndpointProvider.initialize();

    $rootScope.$state = $state;

    // Workaround to prevent the loading bar from going backward
    // https://github.com/chieffancypants/angular-loading-bar/issues/273
    var originalSet = cfpLoadingBar.set;
    cfpLoadingBar.set = function overrideSet(n) {
      if (n > cfpLoadingBar.status()) {
        originalSet.apply(cfpLoadingBar, arguments);
      }
    };

    $transitions.onBefore({}, function () {
      HttpRequestHelper.resetAgentHeaders();
    });

    $state.defaultErrorHandler(function () {
      // Do not log transitionTo errors
    });

    // Keep-alive Edge endpoints by sending a ping request every minute
    $interval(function () {
      ping(EndpointProvider, SystemService);
    }, 60 * 1000);

    $(document).ajaxSend(function (event, jqXhr, jqOpts) {
      const type = jqOpts.type === 'POST' || jqOpts.type === 'PUT' || jqOpts.type === 'PATCH';
      const hasNoContentType = jqOpts.contentType !== 'application/json' && jqOpts.headers && !jqOpts.headers['Content-Type'];
      if (type && hasNoContentType) {
        jqXhr.setRequestHeader('Content-Type', 'application/json');
      }
      jqXhr.setRequestHeader('Authorization', 'Bearer ' + LocalStorage.getJWT());
    });

    // $transitions.onBefore({}, async (transition) => {
    //   const { endpointId } = transition.params();
    //   const currentEndpointId = EndpointProvider.endpointID();
    //   const routerStateService = transition.router.stateService;
    //   if (!endpointId || endpointId === currentEndpointId) {
    //     return true;
    //   }

    //   try {
    //     const endpoint = await EndpointService.endpoint(endpointId);
    //     if (endpoint.Type === 3) {
    //       return await switchToAzureEndpoint(endpoint);
    //     }

    //     if ((endpoint.Type === 4 || endpoint.Type === 7) && !endpoint.EdgeID) {
    //       return routerStateService.target('portainer.endpoints.endpoint', { id: endpoint.Id });
    //     }

    //     if (endpoint.Type === 5 || endpoint.Type === 6) {
    //       return await switchToKubernetesEndpoint(endpoint);
    //     }
    //     if (endpoint.Type === 7) {
    //       return await switchToKubernetesEdgeEndpoint(endpoint);
    //     }

    //     const status = await checkEndpointStatus(endpoint);
    //     if (endpoint.Type !== 4) {
    //       await updateEndpointStatus(endpoint, status);
    //     }
    //     endpoint.Status = status;

    //     return await switchToDockerEndpoint(endpoint);
    //   } catch (error) {
    //     return routerStateService.target('portainer.home', { error });
    //   }

    //   async function switchToKubernetesEdgeEndpoint(endpoint) {
    //     if (!endpoint.EdgeID) {
    //       return routerStateService.target('portainer.endpoints.endpoint', { id: endpoint.Id });
    //     }

    //     EndpointProvider.setEndpointID(endpoint.Id);
    //     // $scope.state.connectingToEdgeEndpoint = true;
    //     try {
    //       await KubernetesHealthService.ping();
    //       endpoint.Status = 1;
    //     } catch (e) {
    //       endpoint.Status = 2;
    //     }
    //     switchToKubernetesEndpoint(endpoint);
    //   }

    //   async function switchToKubernetesEndpoint(endpoint) {
    //     EndpointProvider.setEndpointID(endpoint.Id);
    //     return StateManager.updateEndpointState(endpoint, []);
    //   }

    //   async function checkEndpointStatus(endpoint) {
    //     try {
    //       await SystemService.ping(endpoint.Id);
    //       return 1;
    //     } catch (e) {
    //       return 2;
    //     }
    //   }

    //   async function updateEndpointStatus(endpoint, status) {
    //     if (endpoint.Status === status) {
    //       return;
    //     }
    //     await EndpointService.updateEndpoint(endpoint.Id, { Status: status });
    //   }
    // });
  },
]);

function ping(EndpointProvider, SystemService) {
  let endpoint = EndpointProvider.currentEndpoint();
  if (endpoint !== undefined && endpoint.Type === 4) {
    SystemService.ping(endpoint.Id);
  }
}
