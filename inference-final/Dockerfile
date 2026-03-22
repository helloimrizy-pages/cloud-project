FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.11

RUN pip install "scikit-learn==1.7.2" "numpy<2.3" "scipy<1.15" "joblib" "pandas" boto3 --no-cache-dir

COPY lambda_function.py ${LAMBDA_TASK_ROOT}/

CMD ["lambda_function.handler"]
