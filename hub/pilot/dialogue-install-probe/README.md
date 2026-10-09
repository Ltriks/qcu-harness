# Synthetic dialogue installation probe

Internal test fixture, version 0.0.1-test.1. This is not QCU CSV, a school rule, an App installer or a public Hub release.

The Bundle row is disabled by default. Installation alone must not make the marker Skill active. After the user explicitly approves enabling the exact row through the official Plugin Manager, it registers one in-memory Skill. It does not read or write files, use the network, register tools, start subprocesses or read environment variables. No dependencies or lifecycle scripts are declared; peers are fixed at official rc.2 and Cordis 4.0.4.

The exact marker is QCU_INSTALL_PROBE_TEST_1. A normal startup profile can require a normal Quit/restart after activation. Removing or disabling the row and restarting must remove the Skill. No user App/profile is changed by generating or testing this fixture.

