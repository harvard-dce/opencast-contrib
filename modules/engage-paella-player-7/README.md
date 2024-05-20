# Readme

See paella player 7 for Opencast documentation at [docs/guides/developer/docs/modules/paella-player-7/index.md](../../docs/guides/developer/docs/modules/paella-player-7/index.md)


# #DCE OPC-682

Updated for DCE

### Local Testing Tips

For local testing:

1. Update package.json and add a new webpack serve line with your target Opencast server, if it's not already there
2. Create a theme folder for your developement, if relevant, to etc/ui-config/mh_default_org/paella7/ with a theme.json (copy from another theme as a template)
3. In your theme.json, add your new plugin config, if relevant, and change other plugin and player configuration, if relevant
4. Run you local server with "npm run <name of your  webpack serve target in package.json>"
5. Modifying the code and config and tests to your needs
6. Stop your local server when done


