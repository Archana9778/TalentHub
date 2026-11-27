process.env.NODE_ENV = 'test';
process.env.TEST_IN_PROCESS = 'true';
process.env.DB_MODE = 'json';
process.env.STORAGE_PROVIDER = 'azurite';
process.env.AZURE_STORAGE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';
process.env.AZURE_STORAGE_CONTAINER_NAME = 'talenthub-resumes';
process.env.AZURE_STORAGE_LOGO_CONTAINER_NAME = 'talenthub-company-logos';
